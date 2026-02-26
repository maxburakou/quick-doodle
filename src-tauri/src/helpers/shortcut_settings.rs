use tauri::{AppHandle, Manager, WindowEvent};

use crate::state::WindowState;

use super::utils::toggle_window;

const SHORTCUT_SETTINGS_LABEL: &str = "shortcut-settings";

pub fn open_shortcut_settings_window(app: &AppHandle) {
	let main_was_visible = {
		let state = app.state::<WindowState>();
		let is_visible = state.is_visible.lock().unwrap();
		*is_visible
	};

	if main_was_visible {
		toggle_window(app);
	}

	{
		let state = app.state::<WindowState>();
		let mut restore_main_on_close = state.restore_main_on_shortcut_close.lock().unwrap();
		*restore_main_on_close = main_was_visible;
	}

	if let Some(window) = app.get_webview_window(SHORTCUT_SETTINGS_LABEL) {
		let _ = window.show();
		let _ = window.set_focus();
	} else {
		eprintln!(
			"Shortcut settings window with label '{}' was not found.",
			SHORTCUT_SETTINGS_LABEL
		);
	}
}

pub fn register_shortcut_settings_close_handler(app: &AppHandle) {
	let Some(shortcut_settings_window) = app.get_webview_window(SHORTCUT_SETTINGS_LABEL) else {
		eprintln!(
			"Shortcut settings window with label '{}' was not found.",
			SHORTCUT_SETTINGS_LABEL
		);
		return;
	};

	let app_handle = app.clone();
	let shortcut_window = shortcut_settings_window.clone();

	shortcut_settings_window.on_window_event(move |event| {
		if let WindowEvent::CloseRequested { api, .. } = event {
			api.prevent_close();
			let _ = shortcut_window.hide();

			let should_restore_main = {
				let state = app_handle.state::<WindowState>();
				let mut restore_main = state.restore_main_on_shortcut_close.lock().unwrap();
				let should_restore = *restore_main;
				*restore_main = false;
				should_restore
			};

			if should_restore_main {
				let main_is_visible = {
					let state = app_handle.state::<WindowState>();
					let is_visible = state.is_visible.lock().unwrap();
					*is_visible
				};

				if !main_is_visible {
					let handle = app_handle.clone();
					let _ = app_handle.run_on_main_thread(move || {
						toggle_window(&handle);
					});
				}
			}
		}
	});
}
