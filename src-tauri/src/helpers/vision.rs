use serde::{Deserialize, Serialize};
use tauri::AppHandle;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VisionRecognizeTextRequest {
	pub image_bytes: Vec<u8>,
}

#[derive(Debug, Serialize)]
pub struct VisionRecognizedTextCandidate {
	pub text: String,
	pub confidence: f32,
}

#[derive(Debug, Serialize)]
pub struct VisionRecognizeTextResult {
	pub supported: bool,
	pub text: Option<String>,
	pub confidence: f32,
	pub candidates: Vec<VisionRecognizedTextCandidate>,
	pub error: Option<String>,
}

const MAX_VISION_IMAGE_BYTES: usize = 4 * 1024 * 1024;

#[cfg(target_os = "macos")]
#[link(name = "Vision", kind = "framework")]
extern "C" {}

#[cfg(target_os = "macos")]
fn vision_recognize_text_macos(
	request: VisionRecognizeTextRequest,
) -> Result<VisionRecognizeTextResult, String> {
	use std::ffi::CStr;

	use cocoa::{
		base::{id, nil, YES},
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

	let image_bytes = request.image_bytes;
	if image_bytes.is_empty() {
		return Ok(VisionRecognizeTextResult {
			supported: true,
			text: None,
			confidence: 0.0,
			candidates: Vec::new(),
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
				candidates: Vec::new(),
				error: Some("VNRecognizeTextRequest unavailable".to_string()),
			});
		};
		let Some(handler_class) = Class::get("VNImageRequestHandler") else {
			return Ok(VisionRecognizeTextResult {
				supported: false,
				text: None,
				confidence: 0.0,
				candidates: Vec::new(),
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

		let _: () = msg_send![vision_request, setRecognitionLevel: 0isize];
		let _: () = msg_send![vision_request, setUsesLanguageCorrection: YES];

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
				candidates: Vec::new(),
				error: Some(error_message),
			});
		}

		let observations: id = msg_send![vision_request, results];
		let observation_count: usize = if observations == nil {
			0
		} else {
			msg_send![observations, count]
		};
		let mut candidates = Vec::new();

		for index in 0..observation_count {
			let observation: id = msg_send![observations, objectAtIndex: index];
			if observation == nil {
				continue;
			}

			let recognized_candidates: id = msg_send![observation, topCandidates: 1usize];
			let recognized_count: usize = if recognized_candidates == nil {
				0
			} else {
				msg_send![recognized_candidates, count]
			};
			if recognized_count == 0 {
				continue;
			}

			let candidate: id = msg_send![recognized_candidates, objectAtIndex: 0usize];
			if candidate == nil {
				continue;
			}

			let text_id: id = msg_send![candidate, string];
			let confidence: f32 = msg_send![candidate, confidence];
			if let Some(text) = nsstring_to_string(text_id) {
				let trimmed = text.trim().to_string();
				if !trimmed.is_empty() {
					candidates.push(VisionRecognizedTextCandidate {
						text: trimmed,
						confidence,
					});
				}
			}
		}

		let text = join_vision_candidates(&candidates);
		let confidence = if candidates.is_empty() {
			0.0
		} else {
			candidates
				.iter()
				.map(|candidate| candidate.confidence)
				.sum::<f32>()
				/ candidates.len() as f32
		};

		let _: () = msg_send![handler, release];
		let _: () = msg_send![vision_request, release];
		pool.drain();

		Ok(VisionRecognizeTextResult {
			supported: true,
			text,
			confidence,
			candidates,
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

fn join_vision_candidates(candidates: &[VisionRecognizedTextCandidate]) -> Option<String> {
	let mut text = String::new();
	for candidate in candidates {
		let part = candidate.text.trim();
		if part.is_empty() {
			continue;
		}

		if !text.is_empty() && !part.starts_with(|ch: char| ".,!?;:".contains(ch)) {
			text.push(' ');
		}
		text.push_str(part);
	}

	if text.is_empty() {
		None
	} else {
		Some(text)
	}
}

#[tauri::command]
pub fn smart_assist_vision_recognize_text(
	app: AppHandle,
	request: VisionRecognizeTextRequest,
) -> Result<VisionRecognizeTextResult, String> {
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
			candidates: Vec::new(),
			error: None,
		})
	}
}
