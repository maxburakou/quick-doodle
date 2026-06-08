use serde::{Deserialize, Serialize};
use tauri::AppHandle;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextCorrectionRequest {
	pub text: String,
	#[serde(default)]
	pub language: Option<String>,
	#[serde(default)]
	pub custom_words: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TextCorrectionResult {
	pub supported: bool,
	pub corrected_text: Option<String>,
	pub did_change: bool,
	pub reason: Option<String>,
	pub word_count: usize,
	pub replacement_count: usize,
	pub error: Option<String>,
}

#[cfg(target_os = "macos")]
#[link(name = "AppKit", kind = "framework")]
extern "C" {}

#[cfg(target_os = "macos")]
#[repr(C)]
#[derive(Clone, Copy, Debug)]
struct NSRange {
	location: usize,
	length: usize,
}

#[cfg(target_os = "macos")]
fn correct_text_macos(request: TextCorrectionRequest) -> Result<TextCorrectionResult, String> {
	use std::collections::HashSet;
	use std::ffi::{CStr, CString};

	use cocoa::{
		base::{id, nil},
		foundation::NSAutoreleasePool,
	};
	use objc::{class, msg_send, runtime::Class, sel, sel_impl};

	const NSTEXT_CHECKING_TYPE_SPELLING: u64 = 1 << 1;
	const NSTEXT_CHECKING_TYPE_GRAMMAR: u64 = 1 << 2;
	const NSTEXT_CHECKING_TYPE_CORRECTION: u64 = 1 << 9;

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

	let original_text = request.text.trim().to_string();
	let word_count = count_text_words(&original_text);
	if original_text.is_empty() || word_count <= 1 {
		return Ok(TextCorrectionResult {
			supported: true,
			corrected_text: None,
			did_change: false,
			reason: Some(
				if original_text.is_empty() {
					"empty"
				} else {
					"single-word-skip"
				}
				.to_string(),
			),
			word_count,
			replacement_count: 0,
			error: None,
		});
	}

	unsafe {
		let Some(spell_checker_class) = Class::get("NSSpellChecker") else {
			return Ok(TextCorrectionResult {
				supported: false,
				corrected_text: None,
				did_change: false,
				reason: Some("NSSpellChecker unavailable".to_string()),
				word_count,
				replacement_count: 0,
				error: None,
			});
		};

		let pool = NSAutoreleasePool::new(nil);
		let checker: id = msg_send![spell_checker_class, sharedSpellChecker];
		if checker == nil {
			pool.drain();
			return Ok(TextCorrectionResult {
				supported: false,
				corrected_text: None,
				did_change: false,
				reason: Some("shared spell checker unavailable".to_string()),
				word_count,
				replacement_count: 0,
				error: None,
			});
		}

		let tag: isize = msg_send![spell_checker_class, uniqueSpellDocumentTag];
		let previous_language: id = msg_send![checker, language];
		if let Some(language) = request
			.language
			.as_deref()
			.filter(|language| !language.is_empty())
		{
			if let Ok(language) = CString::new(language) {
				let language_string: id =
					msg_send![class!(NSString), stringWithUTF8String: language.as_ptr()];
				if language_string != nil {
					let _: bool = msg_send![checker, setLanguage: language_string];
				}
			}
		}

		let ignored_words = build_nsstring_array(&request.custom_words);
		let ignored_word_count: usize = msg_send![ignored_words, count];
		if ignored_word_count > 0 {
			let _: () =
				msg_send![checker, setIgnoredWords: ignored_words inSpellDocumentWithTag: tag];
		}

		let Ok(text_cstring) = CString::new(original_text.clone()) else {
			close_spell_document(checker, tag, previous_language);
			pool.drain();
			return Err("text-correction-invalid-string".to_string());
		};
		let string_to_check: id =
			msg_send![class!(NSString), stringWithUTF8String: text_cstring.as_ptr()];
		if string_to_check == nil {
			close_spell_document(checker, tag, previous_language);
			pool.drain();
			return Err("text-correction-nsstring-failed".to_string());
		}
		let mutable_text: id =
			msg_send![class!(NSMutableString), stringWithString: string_to_check];
		if mutable_text == nil {
			close_spell_document(checker, tag, previous_language);
			pool.drain();
			return Err("text-correction-mutable-string-failed".to_string());
		}

		let text_length: usize = msg_send![string_to_check, length];
		let range = NSRange {
			location: 0,
			length: text_length,
		};
		let checking_types = NSTEXT_CHECKING_TYPE_SPELLING
			| NSTEXT_CHECKING_TYPE_GRAMMAR
			| NSTEXT_CHECKING_TYPE_CORRECTION;
		let mut word_count_from_checker: isize = 0;
		let results: id = msg_send![
			checker,
			checkString: string_to_check
			range: range
			types: checking_types
			options: nil
			inSpellDocumentWithTag: tag
			orthography: nil
			wordCount: &mut word_count_from_checker
		];
		let active_language: id = msg_send![checker, language];

		let protected_words: HashSet<String> = request
			.custom_words
			.iter()
			.map(|word| word.to_lowercase())
			.collect();
		let result_count: usize = if results == nil {
			0
		} else {
			msg_send![results, count]
		};
		let mut replacement_count = 0usize;
		for index in (0..result_count).rev() {
			let result: id = msg_send![results, objectAtIndex: index];
			if result == nil {
				continue;
			}

			let result_range: NSRange = msg_send![result, range];
			if result_range.length == 0 || result_range.location + result_range.length > text_length
			{
				continue;
			}
			let result_type: u64 = msg_send![result, resultType];

			let original_part: id = msg_send![string_to_check, substringWithRange: result_range];
			if nsstring_to_string(original_part)
				.map(|part| protected_words.contains(&part.to_lowercase()))
				.unwrap_or(false)
			{
				continue;
			}

			let replacement: id = msg_send![result, replacementString];
			let replacement_text = nsstring_to_string(replacement)
				.filter(|replacement_text| !replacement_text.is_empty())
				.or_else(|| {
					if result_type & NSTEXT_CHECKING_TYPE_SPELLING == 0 || active_language == nil {
						return None;
					}

					let correction: id = msg_send![
						checker,
						correctionForWordRange: result_range
						inString: string_to_check
						language: active_language
						inSpellDocumentWithTag: tag
					];

					nsstring_to_string(correction).filter(|correction| !correction.is_empty())
				})
				.or_else(|| {
					if result_type & NSTEXT_CHECKING_TYPE_SPELLING == 0 {
						return None;
					}

					let guesses: id = msg_send![
						checker,
						guessesForWordRange: result_range
						inString: string_to_check
						language: active_language
						inSpellDocumentWithTag: tag
					];
					if guesses == nil {
						return None;
					}
					let guess_count: usize = msg_send![guesses, count];
					if guess_count == 0 {
						return None;
					}
					let guess: id = msg_send![guesses, objectAtIndex: 0usize];

					nsstring_to_string(guess).filter(|guess| !guess.is_empty())
				});
			let Some(replacement_text) = replacement_text else {
				continue;
			};

			let Ok(replacement_cstring) = CString::new(replacement_text) else {
				continue;
			};
			let replacement_string: id =
				msg_send![class!(NSString), stringWithUTF8String: replacement_cstring.as_ptr()];
			if replacement_string == nil {
				continue;
			}

			let _: () = msg_send![
				mutable_text,
				replaceCharactersInRange: result_range
				withString: replacement_string
			];
			replacement_count += 1;
		}

		let corrected_text =
			nsstring_to_string(mutable_text).unwrap_or_else(|| original_text.clone());
		let did_change = corrected_text != original_text;
		close_spell_document(checker, tag, previous_language);
		pool.drain();

		Ok(TextCorrectionResult {
			supported: true,
			corrected_text: if did_change {
				Some(corrected_text)
			} else {
				None
			},
			did_change,
			reason: Some(
				if did_change {
					"native-correction"
				} else {
					"unchanged"
				}
				.to_string(),
			),
			word_count: if word_count_from_checker > 0 {
				word_count_from_checker as usize
			} else {
				word_count
			},
			replacement_count,
			error: None,
		})
	}
}

#[cfg(target_os = "macos")]
unsafe fn build_nsstring_array(words: &[String]) -> cocoa::base::id {
	use std::ffi::CString;

	use objc::{class, msg_send, sel, sel_impl};

	let array: cocoa::base::id = msg_send![class!(NSMutableArray), array];
	for word in words {
		let Ok(word) = CString::new(word.as_str()) else {
			continue;
		};
		let word_string: cocoa::base::id =
			msg_send![class!(NSString), stringWithUTF8String: word.as_ptr()];
		if word_string != cocoa::base::nil {
			let _: () = msg_send![array, addObject: word_string];
		}
	}

	array
}

#[cfg(target_os = "macos")]
unsafe fn close_spell_document(
	checker: cocoa::base::id,
	tag: isize,
	previous_language: cocoa::base::id,
) {
	use cocoa::base::nil;
	use objc::{msg_send, sel, sel_impl};

	let _: () = msg_send![checker, closeSpellDocumentWithTag: tag];
	if previous_language != nil {
		let _: bool = msg_send![checker, setLanguage: previous_language];
	}
}

fn count_text_words(text: &str) -> usize {
	let mut count = 0usize;
	let mut in_word = false;

	for character in text.chars() {
		if character.is_alphanumeric() {
			if !in_word {
				count += 1;
				in_word = true;
			}
		} else if !matches!(character, '\'' | '.' | '/' | '-') {
			in_word = false;
		}
	}

	count
}

#[cfg(test)]
mod tests {
	use super::count_text_words;

	#[test]
	fn counts_phrase_words() {
		assert_eq!(count_text_words("How ale you!"), 3);
		assert_eq!(count_text_words("HTTP/2 cache"), 2);
	}

	#[test]
	fn keeps_single_terms_single() {
		assert_eq!(count_text_words("MongoDB"), 1);
		assert_eq!(count_text_words("Node.js"), 1);
	}
}

#[tauri::command]
pub fn smart_assist_correct_text(
	app: AppHandle,
	request: TextCorrectionRequest,
) -> Result<TextCorrectionResult, String> {
	#[cfg(target_os = "macos")]
	{
		let (sender, receiver) = std::sync::mpsc::channel();
		app.run_on_main_thread(move || {
			let result = correct_text_macos(request);
			let _ = sender.send(result);
		})
		.map_err(|err| format!("Failed to schedule text correction: {:?}", err))?;

		return receiver
			.recv()
			.map_err(|err| format!("Failed to receive text correction result: {}", err))?;
	}

	#[cfg(not(target_os = "macos"))]
	{
		let _ = app;
		let word_count = count_text_words(&request.text);
		Ok(TextCorrectionResult {
			supported: false,
			corrected_text: None,
			did_change: false,
			reason: Some("unsupported-platform".to_string()),
			word_count,
			replacement_count: 0,
			error: None,
		})
	}
}
