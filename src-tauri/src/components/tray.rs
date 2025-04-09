use tauri::{
	menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem},
	AppHandle, Result, Wry,
};
use tauri_plugin_autostart::ManagerExt;

pub fn create_tray_menu(app: &AppHandle, visibility: bool) -> Result<Menu<Wry>> {
	let autostart_manager = app.autolaunch();
	let is_autostart_enabled = autostart_manager.is_enabled().unwrap();

	let menu_item_undo = MenuItem::with_id(app, "undo", "Undo", visibility, Some("CmdOrCtrl+Z"))?;
	let menu_item_redo =
		MenuItem::with_id(app, "redo", "Redo", visibility, Some("Shift+CmdOrCtrl+Z"))?;
	let menu_item_clear =
		MenuItem::with_id(app, "clear", "Clear", visibility, Some("CmdOrCtrl+C"))?;
	let menu_item_reset =
		MenuItem::with_id(app, "reset", "Reset", visibility, Some("CmdOrCtrl+R"))?;
	let menu_item_quit = MenuItem::with_id(app, "quit", "Quit", true, Some("CmdOrCtrl+Q"))?;
	let menu_item_quit_canvas = MenuItem::with_id(
		app,
		"quit_canvas",
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
		"hide_canvas",
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
		"autostart",
		"Autostart",
		true,
		is_autostart_enabled,
		None::<&str>,
	)?;
	// todo: implement shortcuts configuration
	// let menu_item_shortcuts_config = MenuItem::with_id(app, "shortcuts", "Edit Shortcuts", false, None::<&str>)?;
	let menu_item_background = MenuItem::with_id(
		app,
		"background",
		"Toggle Background",
		visibility,
		Some("CmdOrCtrl+A"),
	)?;
	let menu_item_toolbar = MenuItem::with_id(
		app,
		"toolbar",
		"Toggle Toolbar",
		visibility,
		Some("CmdOrCtrl+Q"),
	)?;

	return Menu::with_items(
		app,
		&[
			&menu_item_undo,
			&menu_item_redo,
			&menu_item_clear,
			&menu_item_reset,
			&menu_item_separator,
			&menu_item_toolbar,
			&menu_item_background,
			&menu_item_separator,
			&menu_item_hide_canvas,
			&menu_item_quit_canvas,
			&menu_item_separator,
			&menu_item_autostart,
			// todo: implement shortcuts configuration
			// &menu_item_shortcuts_config,
			&menu_item_quit,
		],
	);
}
