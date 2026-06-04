use serde::{Deserialize, Serialize};
use tauri::AppHandle;

#[derive(Debug, Serialize)]
pub struct SpellSuggestionResult {
	pub correction: Option<String>,
	pub guesses: Vec<String>,
	pub valid: bool,
}

#[derive(Debug, Deserialize)]
pub struct SpellAnalyzeRequest {
	pub candidates: Vec<String>,
	pub tokens: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct SpellTokenAnalysis {
	pub correction: Option<String>,
	pub completions: Vec<String>,
	pub guesses: Vec<String>,
	pub token: String,
	pub valid: bool,
}

#[derive(Debug, Serialize)]
pub struct SpellCandidateAnalysis {
	pub candidate: String,
	pub misspelled_count: usize,
	pub valid: bool,
}

#[derive(Debug, Serialize)]
pub struct SpellAnalyzeResult {
	pub candidates: Vec<SpellCandidateAnalysis>,
	pub tokens: Vec<SpellTokenAnalysis>,
}

const MAX_BATCH_TOKENS: usize = 32;
const MAX_BATCH_CANDIDATES: usize = 12;
const MAX_SUGGESTIONS_PER_TOKEN: usize = 8;

#[cfg(target_os = "macos")]
fn spell_suggest_macos(word: &str) -> Result<SpellSuggestionResult, String> {
	use std::ffi::CStr;

	use cocoa::{
		base::{id, nil},
		foundation::{NSArray, NSAutoreleasePool, NSNotFound, NSRange, NSString},
	};
	use objc::{class, msg_send, sel, sel_impl};

	unsafe fn to_nsstring(value: &str) -> id {
		NSString::alloc(nil).init_str(value)
	}

	unsafe fn from_nsstring(value: id) -> Option<String> {
		if value == nil {
			return None;
		}

		let utf8_ptr = value.UTF8String();
		if utf8_ptr.is_null() {
			return None;
		}

		Some(CStr::from_ptr(utf8_ptr).to_string_lossy().into_owned())
	}

	unsafe {
		let pool = NSAutoreleasePool::new(nil);
		let ns_word = to_nsstring(word);
		let spell_checker: id = msg_send![class!(NSSpellChecker), sharedSpellChecker];
		let spell_tag: isize = msg_send![class!(NSSpellChecker), uniqueSpellDocumentTag];
		let range = NSRange::new(0, word.len() as _);
		let misspelled_range: NSRange = msg_send![spell_checker, checkSpellingOfString: ns_word startingAt: 0];
		let valid = misspelled_range.location == NSNotFound as u64;

		let correction_id: id = msg_send![
			spell_checker,
			correctionForWordRange: range
			inString: ns_word
			language: nil
			inSpellDocumentWithTag: spell_tag
		];
		let correction = from_nsstring(correction_id).filter(|candidate| candidate != word);

		let guesses_array: id = msg_send![
			spell_checker,
			guessesForWordRange: range
			inString: ns_word
			language: nil
			inSpellDocumentWithTag: spell_tag
		];
		let guesses = if guesses_array == nil {
			Vec::new()
		} else {
			let count = guesses_array.count();
			(0..count)
				.filter_map(|index| from_nsstring(guesses_array.objectAtIndex(index)))
				.filter(|candidate| candidate != word)
				.collect()
		};

		let _: () = msg_send![spell_checker, closeSpellDocumentWithTag: spell_tag];
		let _: () = msg_send![ns_word, release];
		pool.drain();

		Ok(SpellSuggestionResult {
			correction,
			guesses,
			valid,
		})
	}
}

#[cfg(target_os = "macos")]
fn spell_analyze_macos(request: SpellAnalyzeRequest) -> Result<SpellAnalyzeResult, String> {
	use std::ffi::CStr;

	use cocoa::{
		base::{id, nil},
		foundation::{NSArray, NSAutoreleasePool, NSNotFound, NSRange, NSString},
	};
	use objc::{class, msg_send, sel, sel_impl};

	unsafe fn to_nsstring(value: &str) -> id {
		NSString::alloc(nil).init_str(value)
	}

	unsafe fn from_nsstring(value: id) -> Option<String> {
		if value == nil {
			return None;
		}

		let utf8_ptr = value.UTF8String();
		if utf8_ptr.is_null() {
			return None;
		}

		Some(CStr::from_ptr(utf8_ptr).to_string_lossy().into_owned())
	}

	unsafe fn nsarray_to_strings(array: id, limit: usize) -> Vec<String> {
		if array == nil {
			return Vec::new();
		}

		let count = array.count().min(limit as u64);
		(0..count)
			.filter_map(|index| from_nsstring(array.objectAtIndex(index)))
			.collect()
	}

	unsafe {
		let pool = NSAutoreleasePool::new(nil);
		let spell_checker: id = msg_send![class!(NSSpellChecker), sharedSpellChecker];
		let spell_tag: isize = msg_send![class!(NSSpellChecker), uniqueSpellDocumentTag];

		let tokens = request
			.tokens
			.into_iter()
			.filter(|token| !token.trim().is_empty())
			.take(MAX_BATCH_TOKENS)
			.map(|token| {
				let ns_token = to_nsstring(&token);
				let range = NSRange::new(0, token.len() as _);
				let misspelled_range: NSRange =
					msg_send![spell_checker, checkSpellingOfString: ns_token startingAt: 0];
				let valid = misspelled_range.location == NSNotFound as u64;

				let correction_id: id = msg_send![
					spell_checker,
					correctionForWordRange: range
					inString: ns_token
					language: nil
					inSpellDocumentWithTag: spell_tag
				];
				let correction = from_nsstring(correction_id).filter(|candidate| candidate != &token);

				let guesses_array: id = msg_send![
					spell_checker,
					guessesForWordRange: range
					inString: ns_token
					language: nil
					inSpellDocumentWithTag: spell_tag
				];
				let guesses = nsarray_to_strings(guesses_array, MAX_SUGGESTIONS_PER_TOKEN)
					.into_iter()
					.filter(|candidate| candidate != &token)
					.collect();

				let completions_array: id = msg_send![
					spell_checker,
					completionsForPartialWordRange: range
					inString: ns_token
					language: nil
					inSpellDocumentWithTag: spell_tag
				];
				let completions = nsarray_to_strings(completions_array, MAX_SUGGESTIONS_PER_TOKEN)
					.into_iter()
					.filter(|candidate| candidate != &token)
					.collect();

				let _: () = msg_send![ns_token, release];

				SpellTokenAnalysis {
					correction,
					completions,
					guesses,
					token,
					valid,
				}
			})
			.collect();

		let candidates = request
			.candidates
			.into_iter()
			.filter(|candidate| !candidate.trim().is_empty())
			.take(MAX_BATCH_CANDIDATES)
			.map(|candidate| {
				let ns_candidate = to_nsstring(&candidate);
				let mut offset = 0usize;
				let mut misspelled_count = 0usize;

				while offset < candidate.len() {
					let misspelled_range: NSRange = msg_send![
						spell_checker,
						checkSpellingOfString: ns_candidate
						startingAt: offset as u64
					];
					if misspelled_range.location == NSNotFound as u64 {
						break;
					}

					misspelled_count += 1;
					let next_offset = misspelled_range
						.location
						.saturating_add(misspelled_range.length) as usize;
					if next_offset <= offset {
						break;
					}
					offset = next_offset;
				}

				let _: () = msg_send![ns_candidate, release];

				SpellCandidateAnalysis {
					candidate,
					misspelled_count,
					valid: misspelled_count == 0,
				}
			})
			.collect();

		let _: () = msg_send![spell_checker, closeSpellDocumentWithTag: spell_tag];
		pool.drain();

		Ok(SpellAnalyzeResult { candidates, tokens })
	}
}

#[tauri::command]
pub fn smart_assist_spell_suggest(
	app: AppHandle,
	word: String,
) -> Result<SpellSuggestionResult, String> {
	if word.trim().is_empty() {
		return Ok(SpellSuggestionResult {
			correction: None,
			guesses: Vec::new(),
			valid: true,
		});
	}

	#[cfg(target_os = "macos")]
	{
		let (sender, receiver) = std::sync::mpsc::channel();
		app.run_on_main_thread(move || {
			let result = spell_suggest_macos(&word);
			let _ = sender.send(result);
		})
		.map_err(|err| format!("Failed to schedule spellcheck on main thread: {:?}", err))?;

		return receiver
			.recv()
			.map_err(|err| format!("Failed to receive spellcheck result: {}", err))?;
	}

	#[cfg(not(target_os = "macos"))]
	{
		Ok(SpellSuggestionResult {
			correction: None,
			guesses: Vec::new(),
			valid: true,
		})
	}
}

#[tauri::command]
pub fn smart_assist_spell_analyze(
	app: AppHandle,
	request: SpellAnalyzeRequest,
) -> Result<SpellAnalyzeResult, String> {
	#[cfg(target_os = "macos")]
	{
		let (sender, receiver) = std::sync::mpsc::channel();
		app.run_on_main_thread(move || {
			let result = spell_analyze_macos(request);
			let _ = sender.send(result);
		})
		.map_err(|err| format!("Failed to schedule spell analysis on main thread: {:?}", err))?;

		return receiver
			.recv()
			.map_err(|err| format!("Failed to receive spell analysis result: {}", err))?;
	}

	#[cfg(not(target_os = "macos"))]
	{
		let tokens = request
			.tokens
			.into_iter()
			.take(MAX_BATCH_TOKENS)
			.map(|token| SpellTokenAnalysis {
				correction: None,
				completions: Vec::new(),
				guesses: Vec::new(),
				token,
				valid: true,
			})
			.collect();
		let candidates = request
			.candidates
			.into_iter()
			.take(MAX_BATCH_CANDIDATES)
			.map(|candidate| SpellCandidateAnalysis {
				candidate,
				misspelled_count: 0,
				valid: true,
			})
			.collect();

		Ok(SpellAnalyzeResult { candidates, tokens })
	}
}
