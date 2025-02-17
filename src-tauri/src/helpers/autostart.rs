use tauri::AppHandle;
use tauri_plugin_autostart::ManagerExt;

pub fn toggle_autostart(app: &AppHandle) {
  let autostart_manager = app.autolaunch();
  let is_autostart_enabled = autostart_manager.is_enabled().unwrap();

  if is_autostart_enabled {
      let _ = autostart_manager.disable();
  } else {
      let _ = autostart_manager.enable();
  }
}