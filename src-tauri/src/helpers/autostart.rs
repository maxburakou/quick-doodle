use tauri::AppHandle;
use tauri_plugin_autostart::ManagerExt;
use log::warn;

pub fn toggle_autostart(app: &AppHandle) {
	let autostart_manager = app.autolaunch();
	let is_autostart_enabled = match autostart_manager.is_enabled() {
		Ok(enabled) => enabled,
		Err(err) => {
			warn!("Failed to read autostart status: {:?}", err);
			return;
		}
	};

	if is_autostart_enabled {
		if let Err(err) = autostart_manager.disable() {
			warn!("Failed to disable autostart: {:?}", err);
		}
	} else {
		if let Err(err) = autostart_manager.enable() {
			warn!("Failed to enable autostart: {:?}", err);
		}
	}
}
