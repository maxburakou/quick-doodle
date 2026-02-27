use log::warn;
use tauri::AppHandle;
use tauri_plugin_autostart::ManagerExt;

pub fn get_autostart_enabled(app: &AppHandle) -> Result<bool, String> {
	app.autolaunch().is_enabled().map_err(|err| err.to_string())
}

pub fn set_autostart_enabled(app: &AppHandle, enabled: bool) -> Result<(), String> {
	let autostart_manager = app.autolaunch();
	if enabled {
		autostart_manager.enable().map_err(|err| err.to_string())
	} else {
		autostart_manager.disable().map_err(|err| err.to_string())
	}
}

pub fn toggle_autostart(app: &AppHandle) {
	let autostart_manager = app.autolaunch();
	let is_autostart_enabled = match autostart_manager.is_enabled() {
		Ok(enabled) => enabled,
		Err(err) => {
			warn!("Failed to read autostart status: {:?}", err);
			return;
		}
	};

	if let Err(err) = set_autostart_enabled(app, !is_autostart_enabled) {
		warn!("Failed to toggle autostart: {}", err);
	}
}
