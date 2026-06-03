use serde::{Deserialize, Serialize};
use std::{
	io::{BufRead, BufReader, Write},
	path::PathBuf,
	process::{Child, ChildStdin, Command, Stdio},
	sync::Mutex,
	time::Instant,
};
use tauri::{AppHandle, Manager};

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OnlineHtrPoint {
	x: f64,
	y: f64,
	pressure: f64,
	t: Option<f64>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OnlineHtrTextElement {
	value: String,
	font_size: f64,
	width: f64,
	height: f64,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OnlineHtrShapeFill {
	color: String,
	style: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OnlineHtrStroke {
	id: String,
	points: Vec<OnlineHtrPoint>,
	color: String,
	thickness: f64,
	tool: String,
	drawable_seed: Option<f64>,
	is_shift_pressed: Option<bool>,
	rotation: Option<f64>,
	text: Option<OnlineHtrTextElement>,
	shape_fill: Option<OnlineHtrShapeFill>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SidecarRequest<'a> {
	id: u64,
	strokes: &'a [OnlineHtrStroke],
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SidecarResponse {
	id: u64,
	text: Option<String>,
	alternatives: Option<Vec<String>>,
	error: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OnlineHtrRecognitionResult {
	text: String,
	alternatives: Vec<String>,
	engine_ms: u128,
	runtime: &'static str,
}

struct OnlineHtrChild {
	child: Child,
	stdin: ChildStdin,
	stdout: BufReader<std::process::ChildStdout>,
	next_id: u64,
}

#[derive(Default)]
pub struct OnlineHtrState {
	child: Mutex<Option<OnlineHtrChild>>,
}

fn sidecar_script_path(app: &AppHandle) -> Result<PathBuf, String> {
	let dev_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
		.join("sidecars")
		.join("online_htr_sidecar.py");
	if dev_path.exists() {
		return Ok(dev_path);
	}

	let resource_dir = app
		.path()
		.resource_dir()
		.map_err(|err| format!("failed to resolve resource dir: {err}"))?;
	let resource_path = resource_dir.join("sidecars").join("online_htr_sidecar.py");
	if resource_path.exists() {
		return Ok(resource_path);
	}

	Err(format!(
		"online HTR sidecar script not found at {}",
		dev_path.display()
	))
}

fn python_command() -> String {
	std::env::var("QUICK_DOODLE_ONLINE_HTR_PYTHON")
		.ok()
		.filter(|value| !value.trim().is_empty())
		.unwrap_or_else(|| "python3".to_string())
}

fn spawn_child(app: &AppHandle) -> Result<OnlineHtrChild, String> {
	let script_path = sidecar_script_path(app)?;
	let mut child = Command::new(python_command())
		.arg(script_path)
		.stdin(Stdio::piped())
		.stdout(Stdio::piped())
		.stderr(Stdio::inherit())
		.spawn()
		.map_err(|err| format!("failed to start online HTR sidecar: {err}"))?;

	let stdin = child
		.stdin
		.take()
		.ok_or_else(|| "failed to open online HTR sidecar stdin".to_string())?;
	let stdout = child
		.stdout
		.take()
		.ok_or_else(|| "failed to open online HTR sidecar stdout".to_string())?;

	Ok(OnlineHtrChild {
		child,
		stdin,
		stdout: BufReader::new(stdout),
		next_id: 1,
	})
}

fn recognize_with_child(
	child: &mut OnlineHtrChild,
	strokes: &[OnlineHtrStroke],
) -> Result<SidecarResponse, String> {
	let request_id = child.next_id;
	child.next_id += 1;
	let request = SidecarRequest {
		id: request_id,
		strokes,
	};
	let mut payload =
		serde_json::to_string(&request).map_err(|err| format!("serialize request: {err}"))?;
	payload.push('\n');

	child
		.stdin
		.write_all(payload.as_bytes())
		.map_err(|err| format!("write sidecar request: {err}"))?;
	child
		.stdin
		.flush()
		.map_err(|err| format!("flush sidecar request: {err}"))?;

	let mut line = String::new();
	let bytes = child
		.stdout
		.read_line(&mut line)
		.map_err(|err| format!("read sidecar response: {err}"))?;
	if bytes == 0 {
		return Err("online HTR sidecar exited".to_string());
	}

	let response: SidecarResponse =
		serde_json::from_str(&line).map_err(|err| format!("parse sidecar response: {err}"))?;
	if response.id != request_id {
		return Err(format!(
			"sidecar response id mismatch: expected {}, received {}",
			request_id, response.id
		));
	}

	Ok(response)
}

#[tauri::command]
pub async fn online_htr_recognize(
	app: AppHandle,
	strokes: Vec<OnlineHtrStroke>,
) -> Result<OnlineHtrRecognitionResult, String> {
	tauri::async_runtime::spawn_blocking(move || {
		let started_at = Instant::now();
		let state = app.state::<OnlineHtrState>();
		let mut guard = state
			.child
			.lock()
			.map_err(|_| "online HTR sidecar lock poisoned".to_string())?;

		if guard.is_none() {
			*guard = Some(spawn_child(&app)?);
		}

		let response = match guard.as_mut() {
			Some(child) => match recognize_with_child(child, &strokes) {
				Ok(response) => response,
				Err(first_error) => {
					if let Some(mut child) = guard.take() {
						let _ = child.child.kill();
					}
					let mut restarted = spawn_child(&app).map_err(|restart_error| {
						format!("{first_error}; restart failed: {restart_error}")
					})?;
					let response = recognize_with_child(&mut restarted, &strokes)?;
					*guard = Some(restarted);
					response
				}
			},
			None => return Err("online HTR sidecar unavailable".to_string()),
		};

		if let Some(error) = response.error {
			return Err(error);
		}

		Ok(OnlineHtrRecognitionResult {
			text: response.text.unwrap_or_default(),
			alternatives: response.alternatives.unwrap_or_default(),
			engine_ms: started_at.elapsed().as_millis(),
			runtime: "python-sidecar",
		})
	})
	.await
	.map_err(|err| format!("online HTR task failed: {err}"))?
}
