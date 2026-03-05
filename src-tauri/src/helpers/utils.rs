use std::path::PathBuf;
use log::{debug, error, warn};
use tauri::{
	image::Image, AppHandle, Emitter, Manager,
};

use crate::{
	components::tray::apply_visibility_to_tray_menu,
	ids::events,
	state::WindowState,
};
use super::window_service;

pub fn get_icon_path(app: &AppHandle, icon_name: &str) -> PathBuf {
	app.path()
		.resource_dir()
		.expect("Failed to get resource directory")
		.join(format!("icons/tray/{}", icon_name))
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ToggleOutcome {
	Toggled(bool),
	BlockedBySettings,
	Noop,
}

pub fn is_main_open_blocked_by_settings(app: &AppHandle) -> bool {
	let state = app.state::<WindowState>();
	if state.is_main_visible() || !state.is_settings_visible() {
		return false;
	}

	warn!("Main window open blocked while settings is visible");
	let _ = window_service::focus_settings_window(app);
	true
}

pub fn handle_event(app: &AppHandle, event_name: &str) {
	if let Some(window) = window_service::main_window(app) {
		#[cfg(debug_assertions)]
		debug!("EVENT: {}", event_name);
		if let Err(err) = window.emit(event_name, {}) {
			error!("Error emitting {}: {:?}", event_name, err);
		}
	}
}

pub fn warm_tray_icon_cache(app: &AppHandle) {
	let active_icon = match Image::from_path(get_icon_path(app, "tray_icon--active.png")) {
		Ok(icon) => Some(icon),
		Err(err) => {
			warn!("Failed to preload active tray icon: {:?}", err);
			None
		}
	};

	let inactive_icon = match Image::from_path(get_icon_path(app, "tray_icon--inactive.png")) {
		Ok(icon) => Some(icon),
		Err(err) => {
			warn!("Failed to preload inactive tray icon: {:?}", err);
			None
		}
	};

	let state = app.state::<WindowState>();
	state.set_cached_tray_icons(active_icon, inactive_icon);
}

fn get_cached_or_load_tray_icon(app: &AppHandle, use_active: bool) -> Option<Image<'static>> {
	let state = app.state::<WindowState>();

	if let Some(icon) = state.cached_tray_icon(use_active) {
		return Some(icon);
	}

	let icon_name = if use_active {
		"tray_icon--active.png"
	} else {
		"tray_icon--inactive.png"
	};

	match Image::from_path(get_icon_path(app, icon_name)) {
		Ok(icon) => {
			state.update_cached_tray_icon(use_active, icon.clone());
			Some(icon)
		}
		Err(err) => {
			warn!("Failed to load tray icon '{}': {:?}", icon_name, err);
			None
		}
	}
}

pub fn toggle_window(app: &AppHandle) -> ToggleOutcome {
	#[cfg(debug_assertions)]
	let total_start = std::time::Instant::now();

	let state = app.state::<WindowState>();
	let was_visible = state.is_main_visible();

	if !was_visible && is_main_open_blocked_by_settings(app) {
		return ToggleOutcome::BlockedBySettings;
	}

	#[cfg(debug_assertions)]
	let window_start = std::time::Instant::now();

	if was_visible {
		if !window_service::hide_main_window(app) {
			return ToggleOutcome::Noop;
		}
	} else {
		if !window_service::show_main_window(app) {
			return ToggleOutcome::Noop;
		}
	}

	#[cfg(debug_assertions)]
	let window_duration = window_start.elapsed();

	let new_visibility = !was_visible;
	state.set_main_visible(new_visibility);

	if let Some(window) = window_service::main_window(app) {
		if let Err(err) = window.emit(events::MAIN_WINDOW_VISIBILITY_CHANGED, new_visibility) {
			error!(
				"Error emitting {}: {:?}",
				events::MAIN_WINDOW_VISIBILITY_CHANGED,
				err
			);
		}
	}

	#[cfg(debug_assertions)]
	let tray_start = std::time::Instant::now();

	let icon = get_cached_or_load_tray_icon(app, new_visibility);
	let tray_menu_items = state.tray_menu_items();

	state.with_tray_icon(|tray| {
		if let Some(tray) = tray {
			if let Some(icon) = icon {
				if let Err(err) = tray.set_icon(Some(icon)) {
					warn!("Failed to set tray icon: {:?}", err);
				}
			}
			if let Err(err) = tray.set_icon_as_template(!new_visibility) {
				warn!("Failed to set tray icon template state: {:?}", err);
			}
		}
	});
	if let Some(items) = tray_menu_items {
		apply_visibility_to_tray_menu(&items, new_visibility);
	} else {
		warn!("Tray menu item handles are not initialized.");
	}

	#[cfg(debug_assertions)]
	{
		let tray_duration = tray_start.elapsed();
		let total_duration = total_start.elapsed();
		debug!(
			"toggle_window timings: window={:?}, tray={:?}, total={:?}",
			window_duration, tray_duration, total_duration
		);
	}

	ToggleOutcome::Toggled(new_visibility)
}
