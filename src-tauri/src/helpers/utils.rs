use tauri::{
    Manager, AppHandle
};
use std::path::PathBuf;

pub fn get_icon_path(app: &AppHandle, icon_name: &str) -> PathBuf {
    app.path()
        .resource_dir()
        .expect("Failed to get resource directory")
        .join(format!("icons/tray/{}", icon_name))
}