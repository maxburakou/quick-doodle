use log::warn;
use tauri::{AppHandle, Emitter, Manager, WindowEvent};

use crate::{
	components::tray::apply_tray_accelerators_from_settings,
	state::{AppSettingsState, WindowState},
};

use super::{
	autostart::set_autostart_enabled,
	shortcuts::{apply_compiled_to_runtime_state, reapply_global_shortcuts_with_rollback},
	settings_store::save_settings,
	settings_types::{SettingsSnapshot, ValidationIssue},
	settings_validation::validate_shortcuts,
	shortcuts_runtime::compile_shortcuts,
	utils::toggle_window,
	window_service,
};

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

#[tauri::command]
pub fn settings_get_snapshot(app: AppHandle) -> Result<SettingsSnapshot, String> {
	let state = app.state::<AppSettingsState>();
	Ok(state.snapshot())
}

#[tauri::command]
pub fn settings_validate_shortcuts(snapshot: SettingsSnapshot) -> Result<Vec<ValidationIssue>, String> {
	Ok(validate_shortcuts(&snapshot))
}

#[tauri::command]
pub fn settings_restore_defaults() -> Result<SettingsSnapshot, String> {
	Ok(SettingsSnapshot::defaults())
}

#[tauri::command]
pub fn settings_save(app: AppHandle, snapshot: SettingsSnapshot) -> Result<SettingsSnapshot, String> {
	let issues = validate_shortcuts(&snapshot);
	if !issues.is_empty() {
		return Err(serde_json::to_string(&issues).map_err(|err| err.to_string())?);
	}

	let state = app.state::<AppSettingsState>();
	let previous_snapshot = state.snapshot();
	let compiled_old = compile_shortcuts(&previous_snapshot);
	let compiled_new = compile_shortcuts(&snapshot);

	let _registered = reapply_global_shortcuts_with_rollback(&app, &compiled_old, &compiled_new)?;

	if let Err(err) = set_autostart_enabled(&app, snapshot.autostart.enabled) {
		let _ = reapply_global_shortcuts_with_rollback(&app, &compiled_new, &compiled_old);
		return Err(format!("Failed to apply autostart: {}", err));
	}

	if let Some(menu_items) = app.state::<WindowState>().tray_menu_items() {
		if let Err(err) = apply_tray_accelerators_from_settings(&menu_items, &snapshot) {
			let _ = reapply_global_shortcuts_with_rollback(&app, &compiled_new, &compiled_old);
			let _ = set_autostart_enabled(&app, previous_snapshot.autostart.enabled);
			let _ = apply_tray_accelerators_from_settings(&menu_items, &previous_snapshot);
			return Err(format!("Failed to apply tray accelerators: {}", err));
		}
	}

	if let Err(err) = save_settings(&app, &snapshot) {
		let _ = reapply_global_shortcuts_with_rollback(&app, &compiled_new, &compiled_old);
		let _ = set_autostart_enabled(&app, previous_snapshot.autostart.enabled);
		if let Some(menu_items) = app.state::<WindowState>().tray_menu_items() {
			let _ = apply_tray_accelerators_from_settings(&menu_items, &previous_snapshot);
		}
		return Err(format!("Failed to persist settings: {}", err));
	}

	state.set_snapshot(snapshot.clone());
	apply_compiled_to_runtime_state(&app, &compiled_new);
	emit_settings_updated(&app, &snapshot);

	Ok(snapshot)
}

pub fn emit_settings_updated(app: &AppHandle, snapshot: &SettingsSnapshot) {
	if let Err(err) = app.emit("settings-updated", snapshot) {
		warn!("Failed to broadcast settings-updated: {:?}", err);
	}
}
