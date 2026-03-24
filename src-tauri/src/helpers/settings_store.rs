use serde_json::Value;
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

use super::settings_types::{
	Binding, SettingsSnapshot, ShortcutAction, ThemeSettings, SETTINGS_SCHEMA_VERSION,
};

const SETTINGS_STORE_PATH: &str = "settings.json";

pub fn load_settings(app: &AppHandle) -> Result<SettingsSnapshot, String> {
	let store = app
		.store(SETTINGS_STORE_PATH)
		.map_err(|err| err.to_string())?;

	let schema_version = store
		.get("schema_version")
		.and_then(|value| serde_json::from_value::<u32>(value).ok())
		.unwrap_or(SETTINGS_SCHEMA_VERSION);

	let has_legacy_missing_clipboard = store
		.get("shortcuts")
		.and_then(|value| serde_json::from_value::<Value>(value).ok())
		.and_then(|shortcuts| shortcuts.get("canvas").cloned())
		.and_then(|canvas| canvas.get("clipboard").cloned())
		.is_none();

	let defaults = SettingsSnapshot::defaults();

	let mut snapshot = SettingsSnapshot {
		schema_version,
		autostart: store
			.get("autostart")
			.and_then(|value| serde_json::from_value(value).ok())
			.unwrap_or(defaults.autostart),
		theme: store
			.get("theme")
			.and_then(|value| serde_json::from_value(value).ok())
			.unwrap_or(defaults.theme),
		tray: store
			.get("tray")
			.and_then(|value| serde_json::from_value(value).ok())
			.unwrap_or(defaults.tray),
		shortcuts: store
			.get("shortcuts")
			.and_then(|value| serde_json::from_value(value).ok())
			.unwrap_or(defaults.shortcuts),
	};

	if snapshot.schema_version != SETTINGS_SCHEMA_VERSION {
		snapshot = SettingsSnapshot::defaults();
		save_settings(app, &snapshot)?;
		return Ok(snapshot);
	}

	if has_legacy_missing_clipboard {
		let clear_action = snapshot.shortcuts.canvas.history.actions.get_mut("clear");
		if let Some(action) = clear_action {
			if action.bindings.len() == 1 {
				let binding = &action.bindings[0];
				let is_old_default = binding.code == "KeyC"
					&& binding.modifiers.len() == 1
					&& binding
						.modifiers
						.first()
						.map(|value| value == "Primary")
						.unwrap_or(false);
				if is_old_default {
					*action = ShortcutAction {
						bindings: vec![Binding {
							code: "KeyC".to_string(),
							modifiers: vec!["Primary".to_string(), "Shift".to_string()],
						}],
					};
				}
			}
		}
	}

	let legacy_global_theme_action = snapshot.shortcuts.global.actions.remove("cycle_theme_mode");
	let legacy_canvas_theme_action = snapshot
		.shortcuts
		.canvas
		.toggles
		.actions
		.remove("cycle_theme_mode");
	let has_legacy_global_theme_shortcut = legacy_global_theme_action.is_some();
	let has_legacy_canvas_theme_shortcut = legacy_canvas_theme_action.is_some();
	let has_missing_canvas_theme_toggle = !snapshot
		.shortcuts
		.canvas
		.toggles
		.actions
		.contains_key("toggle_theme_mode");

	if has_missing_canvas_theme_toggle {
		let action = legacy_canvas_theme_action
			.or(legacy_global_theme_action)
			.unwrap_or(ShortcutAction {
				bindings: vec![Binding {
					code: "KeyM".to_string(),
					modifiers: vec!["Primary".to_string(), "Shift".to_string()],
				}],
			});
		snapshot
			.shortcuts
			.canvas
			.toggles
			.actions
			.insert("toggle_theme_mode".to_string(), action);
	}

	if has_legacy_missing_clipboard
		|| has_missing_canvas_theme_toggle
		|| has_legacy_global_theme_shortcut
		|| has_legacy_canvas_theme_shortcut
		|| !store.has("schema_version")
		|| !store.has("autostart")
		|| !store.has("theme")
		|| !store.has("tray")
		|| !store.has("shortcuts")
	{
		save_settings(app, &snapshot)?;
	}

	Ok(snapshot)
}

pub fn save_settings(app: &AppHandle, snapshot: &SettingsSnapshot) -> Result<(), String> {
	let store = app
		.store(SETTINGS_STORE_PATH)
		.map_err(|err| err.to_string())?;

	store.set(
		"schema_version",
		Value::from(snapshot.schema_version as u64),
	);
	store.set(
		"autostart",
		serde_json::to_value(&snapshot.autostart).map_err(|err| err.to_string())?,
	);
	store.set(
		"theme",
		serde_json::to_value(&snapshot.theme).map_err(|err| err.to_string())?,
	);
	store.set(
		"tray",
		serde_json::to_value(&snapshot.tray).map_err(|err| err.to_string())?,
	);
	store.set(
		"shortcuts",
		serde_json::to_value(&snapshot.shortcuts).map_err(|err| err.to_string())?,
	);
	store.save().map_err(|err| err.to_string())?;
	Ok(())
}

pub fn save_theme_settings(app: &AppHandle, theme: &ThemeSettings) -> Result<(), String> {
	let store = app
		.store(SETTINGS_STORE_PATH)
		.map_err(|err| err.to_string())?;

	store.set(
		"theme",
		serde_json::to_value(theme).map_err(|err| err.to_string())?,
	);
	store.save().map_err(|err| err.to_string())?;
	Ok(())
}
