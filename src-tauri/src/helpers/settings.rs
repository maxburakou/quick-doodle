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
	settings_validation::{validate_shortcuts, validate_shortcuts_with_compiled},
	shortcuts_runtime::compile_shortcuts,
	utils::toggle_window,
	window_service,
};

pub fn open_settings_window(app: &AppHandle) {
	let state = app.state::<WindowState>();
	let main_was_visible = state.is_main_visible();

	if main_was_visible {
		let _ = toggle_window(app);
	}

	state.set_restore_main_on_settings_close(main_was_visible);

	if !window_service::show_settings_window(app) {
		warn!("Failed to open settings window.");
		return;
	}
	state.set_settings_visible(true);
}

pub fn register_settings_close_handler(app: &AppHandle) {
	let Some(settings_window) = window_service::settings_window(app) else {
		return;
	};

	let app_handle = app.clone();

	settings_window.on_window_event(move |event| {
		if let WindowEvent::CloseRequested { api, .. } = event {
			api.prevent_close();
			if let Err(err) = hide_settings_window_with_restore(&app_handle) {
				warn!("Failed to hide settings window on close request: {}", err);
			}
		}
	});
}

fn hide_settings_window_with_restore(app: &AppHandle) -> Result<(), String> {
	if !window_service::hide_settings_window(app) {
		return Err("Failed to hide settings window.".to_string());
	}

	let state = app.state::<WindowState>();
	state.set_settings_visible(false);
	let should_restore_main = state.take_restore_main_on_settings_close();

	if should_restore_main {
		let main_is_visible = state.is_main_visible();

		if !main_is_visible {
			let handle = app.clone();
			if let Err(err) = app.run_on_main_thread(move || {
				let _ = toggle_window(&handle);
			}) {
				return Err(format!(
					"Failed to restore main window on main thread: {:?}",
					err
				));
			}
		}
	}

	Ok(())
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
	let state = app.state::<AppSettingsState>();
	let previous_snapshot = state.snapshot();
	let compiled_old = compile_shortcuts(&previous_snapshot);
	let compiled_new = compile_shortcuts(&snapshot);

	let issues = validate_shortcuts_with_compiled(&compiled_new, &snapshot);
	if !issues.is_empty() {
		return Err(serde_json::to_string(&issues).map_err(|err| err.to_string())?);
	}

	let _registered = reapply_global_shortcuts_with_rollback(&app, &compiled_old, &compiled_new)?;

	if let Err(err) = set_autostart_enabled(&app, snapshot.autostart.enabled) {
		let _ = reapply_global_shortcuts_with_rollback(&app, &compiled_new, &compiled_old);
		return Err(format!("Failed to apply autostart: {}", err));
	}

	let window_state = app.state::<WindowState>();
	let tray_result = window_state.with_tray_menu_items(|menu_items| {
		if let Some(menu_items) = menu_items {
			if let Err(err) = apply_tray_accelerators_from_settings(menu_items, &snapshot) {
				return Err(err);
			}
		}
		Ok(())
	});

	if let Err(err) = tray_result {
		let _ = reapply_global_shortcuts_with_rollback(&app, &compiled_new, &compiled_old);
		let _ = set_autostart_enabled(&app, previous_snapshot.autostart.enabled);
		window_state.with_tray_menu_items(|menu_items| {
			if let Some(menu_items) = menu_items {
				let _ = apply_tray_accelerators_from_settings(menu_items, &previous_snapshot);
			}
		});
		return Err(format!("Failed to apply tray accelerators: {}", err));
	}

	if let Err(err) = save_settings(&app, &snapshot) {
		let _ = reapply_global_shortcuts_with_rollback(&app, &compiled_new, &compiled_old);
		let _ = set_autostart_enabled(&app, previous_snapshot.autostart.enabled);
		window_state.with_tray_menu_items(|menu_items| {
			if let Some(menu_items) = menu_items {
				let _ = apply_tray_accelerators_from_settings(menu_items, &previous_snapshot);
			}
		});
		return Err(format!("Failed to persist settings: {}", err));
	}

	state.set_snapshot(snapshot.clone());
	apply_compiled_to_runtime_state(&app, &compiled_new);
	emit_settings_updated(&app, &snapshot);

	Ok(snapshot)
}

#[tauri::command]
pub fn settings_hide_window(app: AppHandle) -> Result<(), String> {
	hide_settings_window_with_restore(&app)
}

pub fn emit_settings_updated(app: &AppHandle, snapshot: &SettingsSnapshot) {
	if let Err(err) = app.emit("settings-updated", snapshot) {
		warn!("Failed to broadcast settings-updated: {:?}", err);
	}
}
