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
