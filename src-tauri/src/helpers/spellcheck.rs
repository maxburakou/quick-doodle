use serde::Serialize;
use tauri::AppHandle;

#[derive(Debug, Serialize)]
pub struct SpellSuggestionResult {
	pub correction: Option<String>,
	pub guesses: Vec<String>,
	pub valid: bool,
}

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
