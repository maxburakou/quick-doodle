use serde_json::Value;
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

use super::settings_types::{Binding, SettingsSnapshot, ShortcutAction, SETTINGS_SCHEMA_VERSION};

const SETTINGS_STORE_PATH: &str = "settings.json";

pub fn load_settings(app: &AppHandle) -> Result<SettingsSnapshot, String> {
	let store = app.store(SETTINGS_STORE_PATH).map_err(|err| err.to_string())?;

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
					&& binding.modifiers.first().map(|value| value == "Primary").unwrap_or(false);
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

	if has_legacy_missing_clipboard
		|| !store.has("schema_version")
		|| !store.has("autostart")
		|| !store.has("shortcuts")
	{
		save_settings(app, &snapshot)?;
	}

	Ok(snapshot)
}

pub fn save_settings(app: &AppHandle, snapshot: &SettingsSnapshot) -> Result<(), String> {
	let store = app.store(SETTINGS_STORE_PATH).map_err(|err| err.to_string())?;

	store.set(
		"schema_version",
		Value::from(snapshot.schema_version as u64),
	);
	store.set(
		"autostart",
		serde_json::to_value(&snapshot.autostart).map_err(|err| err.to_string())?,
	);
	store.set(
		"shortcuts",
		serde_json::to_value(&snapshot.shortcuts).map_err(|err| err.to_string())?,
	);
	store.save().map_err(|err| err.to_string())?;
	Ok(())
}
