use std::sync::{Arc, Mutex};
use tauri::tray::TrayIcon;

pub struct WindowState {
	pub is_visible: Mutex<bool>,
	pub tray_icon: Arc<Mutex<Option<TrayIcon>>>,
}

impl WindowState {
	pub fn new() -> Self {
		Self {
			is_visible: Mutex::new(false),
			tray_icon: Arc::new(Mutex::new(None)),
		}
	}
}
