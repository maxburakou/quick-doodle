use log::warn;
use tauri::{AppHandle, Manager, WebviewWindow};

use crate::ids::window_labels;

pub fn main_window(app: &AppHandle) -> Option<WebviewWindow> {
	let window = app.get_webview_window(window_labels::MAIN);
	if window.is_none() {
		warn!(
			"Main window with label '{}' was not found.",
			window_labels::MAIN
		);
	}
	window
}

pub fn settings_window(app: &AppHandle) -> Option<WebviewWindow> {
	let window = app.get_webview_window(window_labels::SETTINGS);
	if window.is_none() {
		warn!(
			"Settings window with label '{}' was not found.",
			window_labels::SETTINGS
		);
	}
	window
}

pub fn show_main_window(app: &AppHandle) -> bool {
	let Some(window) = main_window(app) else {
		return false;
	};
	if let Err(err) = window.show() {
		warn!("Failed to show main window: {:?}", err);
		return false;
	}
	if let Err(err) = window.set_focus() {
		warn!("Failed to focus main window: {:?}", err);
	}
	true
}

pub fn hide_main_window(app: &AppHandle) -> bool {
	let Some(window) = main_window(app) else {
		return false;
	};
	if let Err(err) = window.hide() {
		warn!("Failed to hide main window: {:?}", err);
		return false;
	}
	true
}

pub fn show_settings_window(app: &AppHandle) -> bool {
	let Some(window) = settings_window(app) else {
		return false;
	};
	if let Err(err) = window.show() {
		warn!("Failed to show settings window: {:?}", err);
		return false;
	}
	if let Err(err) = window.set_focus() {
		warn!("Failed to focus settings window: {:?}", err);
	}
	true
}

pub fn hide_settings_window(app: &AppHandle) -> bool {
	let Some(window) = settings_window(app) else {
		return false;
	};
	if let Err(err) = window.hide() {
		warn!("Failed to hide settings window: {:?}", err);
		return false;
	}
	true
}
