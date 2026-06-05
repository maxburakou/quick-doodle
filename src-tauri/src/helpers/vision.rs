use serde::{Deserialize, Serialize};
use tauri::{ipc::InvokeBody, AppHandle};

const VISION_OPTIONS_HEADER: &str = "x-quick-doodle-vision-options";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VisionRecognizeTextRequest {
	pub image_bytes: Vec<u8>,
	#[serde(default)]
	pub options: VisionRecognizeTextOptions,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VisionRecognizeTextOptions {
	#[serde(default = "default_recognition_level")]
	pub recognition_level: VisionRecognitionLevel,
	#[serde(default = "default_uses_language_correction")]
	pub uses_language_correction: bool,
	#[serde(default)]
	pub recognition_languages: Vec<String>,
	#[serde(default)]
	pub minimum_text_height: Option<f32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum VisionRecognitionLevel {
	Accurate,
	Fast,
}

impl Default for VisionRecognizeTextOptions {
	fn default() -> Self {
		Self {
			recognition_level: default_recognition_level(),
			uses_language_correction: default_uses_language_correction(),
			recognition_languages: Vec::new(),
			minimum_text_height: None,
		}
	}
}

fn default_recognition_level() -> VisionRecognitionLevel {
	VisionRecognitionLevel::Accurate
}

fn default_uses_language_correction() -> bool {
	true
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VisionTextBounds {
	pub x: f32,
	pub y: f32,
	pub width: f32,
	pub height: f32,
}

#[derive(Debug, Serialize)]
pub struct VisionRecognizedTextAlternative {
	pub text: String,
	pub confidence: f32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VisionRecognizedTextLine {
	pub text: String,
	pub confidence: f32,
	pub bounds: VisionTextBounds,
	pub alternatives: Vec<VisionRecognizedTextAlternative>,
}

#[derive(Debug, Serialize)]
pub struct VisionRecognizeTextResult {
	pub supported: bool,
	pub text: Option<String>,
	pub confidence: f32,
	pub lines: Vec<VisionRecognizedTextLine>,
	pub error: Option<String>,
}

const MAX_VISION_IMAGE_BYTES: usize = 4 * 1024 * 1024;

#[cfg(target_os = "macos")]
#[link(name = "Vision", kind = "framework")]
extern "C" {}

#[cfg(target_os = "macos")]
#[repr(C)]
#[derive(Clone, Copy, Debug)]
struct CGPoint {
	x: f64,
	y: f64,
}

#[cfg(target_os = "macos")]
#[repr(C)]
#[derive(Clone, Copy, Debug)]
struct CGSize {
	width: f64,
	height: f64,
}

#[cfg(target_os = "macos")]
#[repr(C)]
#[derive(Clone, Copy, Debug)]
struct CGRect {
	origin: CGPoint,
	size: CGSize,
}

#[cfg(target_os = "macos")]
fn vision_recognize_text_macos(
	request: VisionRecognizeTextRequest,
) -> Result<VisionRecognizeTextResult, String> {
	use std::ffi::{CStr, CString};

	use cocoa::{
		base::{id, nil, NO, YES},
		foundation::NSAutoreleasePool,
	};
	use objc::{class, msg_send, runtime::Class, sel, sel_impl};

	unsafe fn nsstring_to_string(value: id) -> Option<String> {
		if value == nil {
			return None;
		}

		let utf8_ptr: *const i8 = msg_send![value, UTF8String];
		if utf8_ptr.is_null() {
			return None;
		}

		Some(CStr::from_ptr(utf8_ptr).to_string_lossy().into_owned())
	}

	let VisionRecognizeTextRequest {
		image_bytes,
		options,
	} = request;
	if image_bytes.is_empty() {
		return Ok(VisionRecognizeTextResult {
			supported: true,
			text: None,
			confidence: 0.0,
			lines: Vec::new(),
			error: None,
		});
	}
	if image_bytes.len() > MAX_VISION_IMAGE_BYTES {
		return Err("vision-image-too-large".to_string());
	}

	unsafe {
		let Some(request_class) = Class::get("VNRecognizeTextRequest") else {
			return Ok(VisionRecognizeTextResult {
				supported: false,
				text: None,
				confidence: 0.0,
				lines: Vec::new(),
				error: Some("VNRecognizeTextRequest unavailable".to_string()),
			});
		};
		let Some(handler_class) = Class::get("VNImageRequestHandler") else {
			return Ok(VisionRecognizeTextResult {
				supported: false,
				text: None,
				confidence: 0.0,
				lines: Vec::new(),
				error: Some("VNImageRequestHandler unavailable".to_string()),
			});
		};
		let Some(data_class) = Class::get("NSData") else {
			return Err("vision-nsdata-unavailable".to_string());
		};

		let pool = NSAutoreleasePool::new(nil);
		let data: id = msg_send![
			data_class,
			dataWithBytes: image_bytes.as_ptr()
			length: image_bytes.len()
		];
		if data == nil {
			pool.drain();
			return Err("vision-invalid-image-data".to_string());
		}

		let vision_request: id = msg_send![request_class, alloc];
		let vision_request: id = msg_send![vision_request, init];
		if vision_request == nil {
			pool.drain();
			return Err("vision-request-init-failed".to_string());
		}

		let recognition_level = match options.recognition_level {
			VisionRecognitionLevel::Accurate => 0isize,
			VisionRecognitionLevel::Fast => 1isize,
		};
		let uses_language_correction = if options.uses_language_correction {
			YES
		} else {
			NO
		};
		let _: () = msg_send![vision_request, setRecognitionLevel: recognition_level];
		let _: () = msg_send![vision_request, setUsesLanguageCorrection: uses_language_correction];
		if let Some(minimum_text_height) = options.minimum_text_height {
			let _: () = msg_send![vision_request, setMinimumTextHeight: minimum_text_height];
		}
		if !options.recognition_languages.is_empty() {
			let languages: id = msg_send![class!(NSMutableArray), array];
			for language in options.recognition_languages {
				let Ok(language) = CString::new(language) else {
					continue;
				};
				let language_string: id =
					msg_send![class!(NSString), stringWithUTF8String: language.as_ptr()];
				if language_string != nil {
					let _: () = msg_send![languages, addObject: language_string];
				}
			}
			let language_count: usize = msg_send![languages, count];
			if language_count > 0 {
				let _: () = msg_send![vision_request, setRecognitionLanguages: languages];
			}
		}

		let handler: id = msg_send![handler_class, alloc];
		let handler: id = msg_send![handler, initWithData: data options: nil];
		if handler == nil {
			let _: () = msg_send![vision_request, release];
			pool.drain();
			return Err("vision-handler-init-failed".to_string());
		}

		let requests: id = msg_send![class!(NSArray), arrayWithObject: vision_request];
		let mut error: id = nil;
		let success: bool = msg_send![handler, performRequests: requests error: &mut error];
		if !success {
			let error_message = describe_nserror(error)
				.unwrap_or_else(|| "Vision performRequests failed".to_string());
			let _: () = msg_send![handler, release];
			let _: () = msg_send![vision_request, release];
			pool.drain();
			return Ok(VisionRecognizeTextResult {
				supported: true,
				text: None,
				confidence: 0.0,
				lines: Vec::new(),
				error: Some(error_message),
			});
		}

		let observations: id = msg_send![vision_request, results];
		let observation_count: usize = if observations == nil {
			0
		} else {
			msg_send![observations, count]
		};
		let mut lines = Vec::new();

		for index in 0..observation_count {
			let observation: id = msg_send![observations, objectAtIndex: index];
			if observation == nil {
				continue;
			}

			let recognized_candidates: id = msg_send![observation, topCandidates: 3usize];
			let recognized_count: usize = if recognized_candidates == nil {
				0
			} else {
				msg_send![recognized_candidates, count]
			};
			if recognized_count == 0 {
				continue;
			}

			let primary: id = msg_send![recognized_candidates, objectAtIndex: 0usize];
			if primary == nil {
				continue;
			}

			let text_id: id = msg_send![primary, string];
			let confidence: f32 = msg_send![primary, confidence];
			let Some(text) = nsstring_to_string(text_id)
				.map(|text| text.trim().to_string())
				.filter(|text| !text.is_empty())
			else {
				continue;
			};

			let bounding_box: CGRect = msg_send![observation, boundingBox];
			let mut alternatives = Vec::new();
			for candidate_index in 1..recognized_count {
				let candidate: id =
					msg_send![recognized_candidates, objectAtIndex: candidate_index];
				if candidate == nil {
					continue;
				}

				let alternative_text_id: id = msg_send![candidate, string];
				let alternative_confidence: f32 = msg_send![candidate, confidence];
				let Some(alternative_text) = nsstring_to_string(alternative_text_id)
					.map(|text| text.trim().to_string())
					.filter(|alternative_text| {
						!alternative_text.is_empty() && alternative_text != &text
					})
				else {
					continue;
				};

				if alternatives
					.iter()
					.any(|alternative: &VisionRecognizedTextAlternative| {
						alternative.text == alternative_text
					}) {
					continue;
				}

				alternatives.push(VisionRecognizedTextAlternative {
					text: alternative_text,
					confidence: alternative_confidence,
				});
			}

			lines.push(VisionRecognizedTextLine {
				text,
				confidence,
				bounds: VisionTextBounds {
					x: bounding_box.origin.x as f32,
					y: bounding_box.origin.y as f32,
					width: bounding_box.size.width as f32,
					height: bounding_box.size.height as f32,
				},
				alternatives,
			});
		}

		sort_vision_lines(&mut lines);
		let text = join_vision_lines(&lines);
		let confidence = if lines.is_empty() {
			0.0
		} else {
			lines.iter().map(|line| line.confidence).sum::<f32>() / lines.len() as f32
		};

		let _: () = msg_send![handler, release];
		let _: () = msg_send![vision_request, release];
		pool.drain();

		Ok(VisionRecognizeTextResult {
			supported: true,
			text,
			confidence,
			lines,
			error: None,
		})
	}
}

#[cfg(target_os = "macos")]
unsafe fn describe_nserror(error: cocoa::base::id) -> Option<String> {
	use std::ffi::CStr;

	use cocoa::base::nil;
	use objc::{msg_send, sel, sel_impl};

	if error == nil {
		return None;
	}

	let description: cocoa::base::id = msg_send![error, localizedDescription];
	if description == nil {
		return None;
	}

	let utf8_ptr: *const i8 = msg_send![description, UTF8String];
	if utf8_ptr.is_null() {
		return None;
	}

	Some(CStr::from_ptr(utf8_ptr).to_string_lossy().into_owned())
}

fn sort_vision_lines(lines: &mut [VisionRecognizedTextLine]) {
	lines.sort_by(|left, right| {
		let left_top = left.bounds.y + left.bounds.height;
		let right_top = right.bounds.y + right.bounds.height;

		right_top
			.partial_cmp(&left_top)
			.unwrap_or(std::cmp::Ordering::Equal)
			.then_with(|| {
				left.bounds
					.x
					.partial_cmp(&right.bounds.x)
					.unwrap_or(std::cmp::Ordering::Equal)
			})
	});
}

fn join_vision_lines(lines: &[VisionRecognizedTextLine]) -> Option<String> {
	let mut text = String::new();
	let mut current_row_center_y: Option<f32> = None;
	let mut current_row_height: f32 = 0.0;

	for line in lines {
		let part = line.text.trim();
		if part.is_empty() {
			continue;
		}

		if !text.is_empty() {
			let center_y = line.bounds.y + line.bounds.height / 2.0;
			let row_threshold = current_row_height.max(line.bounds.height) * 0.6;
			let same_row = current_row_center_y
				.map(|row_center_y| (center_y - row_center_y).abs() <= row_threshold)
				.unwrap_or(false);

			if same_row && !part.starts_with(|ch: char| ".,!?;:".contains(ch)) {
				text.push(' ');
			} else if !same_row {
				text.push('\n');
			}
		}

		let center_y = line.bounds.y + line.bounds.height / 2.0;
		if let Some(row_center_y) = current_row_center_y {
			let row_threshold = current_row_height.max(line.bounds.height) * 0.6;
			if (center_y - row_center_y).abs() <= row_threshold {
				current_row_center_y = Some((row_center_y + center_y) / 2.0);
				current_row_height = current_row_height.max(line.bounds.height);
			} else {
				current_row_center_y = Some(center_y);
				current_row_height = line.bounds.height;
			}
		} else {
			current_row_center_y = Some(center_y);
			current_row_height = line.bounds.height;
		}

		text.push_str(part);
	}

	if text.is_empty() {
		None
	} else {
		Some(text)
	}
}

fn vision_request_from_ipc_request(
	request: tauri::ipc::Request<'_>,
) -> Result<VisionRecognizeTextRequest, String> {
	match request.body() {
		InvokeBody::Raw(image_bytes) => {
			let options = request
				.headers()
				.get(VISION_OPTIONS_HEADER)
				.map(|value| {
					value
						.to_str()
						.map_err(|err| format!("vision-options-header-invalid: {}", err))
						.and_then(|value| {
							serde_json::from_str::<VisionRecognizeTextOptions>(value)
								.map_err(|err| format!("vision-options-json-invalid: {}", err))
						})
				})
				.transpose()?
				.unwrap_or_default();

			Ok(VisionRecognizeTextRequest {
				image_bytes: image_bytes.clone(),
				options,
			})
		}
		InvokeBody::Json(value) => serde_json::from_value::<VisionRecognizeTextRequest>(
			value.clone(),
		)
		.map_err(|err| format!("vision-json-request-invalid: {}", err)),
	}
}

#[tauri::command]
pub fn smart_assist_vision_recognize_text(
	app: AppHandle,
	request: tauri::ipc::Request<'_>,
) -> Result<VisionRecognizeTextResult, String> {
	let request = vision_request_from_ipc_request(request)?;

	#[cfg(target_os = "macos")]
	{
		let (sender, receiver) = std::sync::mpsc::channel();
		app.run_on_main_thread(move || {
			let result = vision_recognize_text_macos(request);
			let _ = sender.send(result);
		})
		.map_err(|err| format!("Failed to schedule Vision recognition: {:?}", err))?;

		return receiver
			.recv()
			.map_err(|err| format!("Failed to receive Vision recognition result: {}", err))?;
	}

	#[cfg(not(target_os = "macos"))]
	{
		let _ = app;
		let _ = request;
		Ok(VisionRecognizeTextResult {
			supported: false,
			text: None,
			confidence: 0.0,
			lines: Vec::new(),
			error: None,
		})
	}
}
