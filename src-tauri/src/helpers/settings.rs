use log::warn;
use tauri::{AppHandle, Manager, WindowEvent};

use crate::state::WindowState;

use super::{utils::toggle_window, window_service};

pub fn open_settings_window(app: &AppHandle) {
	let state = app.state::<WindowState>();
	let main_was_visible = state.is_main_visible();

	if main_was_visible {
		toggle_window(app);
	}

	state.set_restore_main_on_settings_close(main_was_visible);

	if !window_service::show_settings_window(app) {
		warn!("Failed to open settings window.");
	}
}

pub fn register_settings_close_handler(app: &AppHandle) {
	let Some(settings_window) = window_service::settings_window(app) else {
		return;
	};

	let app_handle = app.clone();

	settings_window.on_window_event(move |event| {
		if let WindowEvent::CloseRequested { api, .. } = event {
			api.prevent_close();
			if !window_service::hide_settings_window(&app_handle) {
				warn!("Failed to hide settings window on close request.");
			}

			let state = app_handle.state::<WindowState>();
			let should_restore_main = state.take_restore_main_on_settings_close();

			if should_restore_main {
				let main_is_visible = state.is_main_visible();

				if !main_is_visible {
					let handle = app_handle.clone();
					// Keep UI work on main thread for window operations from close event callback.
					if let Err(err) = app_handle.run_on_main_thread(move || {
						toggle_window(&handle);
					}) {
						warn!("Failed to restore main window on main thread: {:?}", err);
					}
				}
			}
		}
	});
}
