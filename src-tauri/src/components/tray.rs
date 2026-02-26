use tauri::{
	menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem},
	AppHandle, Result, Wry,
};
use tauri_plugin_autostart::ManagerExt;
use log::warn;

use crate::ids::menu_ids;

#[derive(Clone)]
pub struct TrayMenuItems {
	pub undo: MenuItem<Wry>,
	pub redo: MenuItem<Wry>,
	pub clear: MenuItem<Wry>,
	pub reset: MenuItem<Wry>,
	pub toolbar: MenuItem<Wry>,
	pub background: MenuItem<Wry>,
	pub snap: MenuItem<Wry>,
	pub hide_canvas: MenuItem<Wry>,
	pub quit_canvas: MenuItem<Wry>,
}

pub fn apply_visibility_to_tray_menu(items: &TrayMenuItems, visibility: bool) {
	if let Err(err) = items.undo.set_enabled(visibility) {
		warn!("Failed to update 'undo' menu state: {:?}", err);
	}
	if let Err(err) = items.redo.set_enabled(visibility) {
		warn!("Failed to update 'redo' menu state: {:?}", err);
	}
	if let Err(err) = items.clear.set_enabled(visibility) {
		warn!("Failed to update 'clear' menu state: {:?}", err);
	}
	if let Err(err) = items.reset.set_enabled(visibility) {
		warn!("Failed to update 'reset' menu state: {:?}", err);
	}
	if let Err(err) = items.toolbar.set_enabled(visibility) {
		warn!("Failed to update 'toolbar' menu state: {:?}", err);
	}
	if let Err(err) = items.background.set_enabled(visibility) {
		warn!("Failed to update 'background' menu state: {:?}", err);
	}
	if let Err(err) = items.snap.set_enabled(visibility) {
		warn!("Failed to update 'snap' menu state: {:?}", err);
	}
	if let Err(err) = items.hide_canvas.set_text(if visibility {
		"Hide Drawing Canvas"
	} else {
		"Show Drawing Canvas"
	}) {
		warn!("Failed to update 'hide_canvas' menu text: {:?}", err);
	}
	if let Err(err) = items.quit_canvas.set_text(if visibility {
		"Quit Drawing Canvas"
	} else {
		"New Drawing Canvas"
	}) {
		warn!("Failed to update 'quit_canvas' menu text: {:?}", err);
	}
}

pub fn create_tray_menu(app: &AppHandle, visibility: bool) -> Result<(Menu<Wry>, TrayMenuItems)> {
	let autostart_manager = app.autolaunch();
	let is_autostart_enabled = match autostart_manager.is_enabled() {
		Ok(enabled) => enabled,
		Err(err) => {
			warn!("Failed to read autostart status: {:?}", err);
			false
		}
	};

	let menu_item_undo =
		MenuItem::with_id(app, menu_ids::UNDO, "Undo", visibility, Some("CmdOrCtrl+Z"))?;
	let menu_item_redo =
		MenuItem::with_id(app, menu_ids::REDO, "Redo", visibility, Some("Shift+CmdOrCtrl+Z"))?;
	let menu_item_clear =
		MenuItem::with_id(app, menu_ids::CLEAR, "Clear", visibility, Some("CmdOrCtrl+C"))?;
	let menu_item_reset =
		MenuItem::with_id(app, menu_ids::RESET, "Reset", visibility, Some("CmdOrCtrl+R"))?;
	let menu_item_quit = MenuItem::with_id(app, menu_ids::QUIT, "Quit", true, Some("CmdOrCtrl+Q"))?;
	let menu_item_quit_canvas = MenuItem::with_id(
		app,
		menu_ids::QUIT_CANVAS,
		if visibility {
			"Quit Drawing Canvas"
		} else {
			"New Drawing Canvas"
		},
		true,
		Some("Shift+CmdOrCtrl+D"),
	)?;
	let menu_item_hide_canvas = MenuItem::with_id(
		app,
		menu_ids::HIDE_CANVAS,
		if visibility {
			"Hide Drawing Canvas"
		} else {
			"Show Drawing Canvas"
		},
		true,
		Some("Shift+CmdOrCtrl+S"),
	)?;
	let menu_item_separator = PredefinedMenuItem::separator(app)?;
	let menu_item_autostart = CheckMenuItem::with_id(
		app,
		menu_ids::AUTOSTART,
		"Autostart",
		true,
		is_autostart_enabled,
		None::<&str>,
	)?;
	let menu_item_settings = MenuItem::with_id(
		app,
		menu_ids::SETTINGS,
		"Settings",
		true,
		None::<&str>,
	)?;
	let menu_item_background = MenuItem::with_id(
		app,
		menu_ids::BACKGROUND,
		"Toggle Background",
		visibility,
		Some("CmdOrCtrl+A"),
	)?;
	let menu_item_toolbar = MenuItem::with_id(
		app,
		menu_ids::TOOLBAR,
		"Toggle Toolbar",
		visibility,
		Some("CmdOrCtrl+T"),
	)?;
	let menu_item_snap = MenuItem::with_id(
		app,
		menu_ids::SNAP,
		"Toggle Snap Hints",
		visibility,
		Some("CmdOrCtrl+E"),
	)?;

	let menu = Menu::with_items(
		app,
		&[
			&menu_item_undo,
			&menu_item_redo,
			&menu_item_clear,
			&menu_item_reset,
			&menu_item_separator,
			&menu_item_toolbar,
			&menu_item_background,
			&menu_item_snap,
			&menu_item_separator,
			&menu_item_hide_canvas,
			&menu_item_quit_canvas,
			&menu_item_separator,
			&menu_item_autostart,
			&menu_item_settings,
			&menu_item_quit,
		],
	)?;

	let items = TrayMenuItems {
		undo: menu_item_undo,
		redo: menu_item_redo,
		clear: menu_item_clear,
		reset: menu_item_reset,
		toolbar: menu_item_toolbar,
		background: menu_item_background,
		snap: menu_item_snap,
		hide_canvas: menu_item_hide_canvas,
		quit_canvas: menu_item_quit_canvas,
	};

	Ok((menu, items))
}
