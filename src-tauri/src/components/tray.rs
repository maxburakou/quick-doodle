use log::warn;
use tauri::{
	menu::{Menu, MenuItem, PredefinedMenuItem},
	AppHandle, Result, Wry,
};

use crate::helpers::settings_types::{SettingsSnapshot, ThemeMode};
use crate::helpers::shortcuts_runtime::{action_primary_binding, binding_to_accelerator};
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
	pub cycle_theme_mode: MenuItem<Wry>,
	pub hide_canvas: MenuItem<Wry>,
	pub quit_canvas: MenuItem<Wry>,
}

fn theme_mode_label(mode: ThemeMode) -> &'static str {
	match mode {
		ThemeMode::Light => "Toggle Theme: Light",
		ThemeMode::Dark => "Toggle Theme: Dark",
		ThemeMode::System => "Toggle Theme: System",
	}
}

pub fn apply_theme_mode_to_tray_menu(items: &TrayMenuItems, mode: ThemeMode) {
	if let Err(err) = items.cycle_theme_mode.set_text(theme_mode_label(mode)) {
		warn!("Failed to update 'cycle_theme_mode' menu text: {:?}", err);
	}
}

pub fn apply_visibility_to_tray_menu(items: &TrayMenuItems, visibility: bool) {
	for (name, item) in [
		("undo", &items.undo),
		("redo", &items.redo),
		("clear", &items.clear),
		("reset", &items.reset),
		("toolbar", &items.toolbar),
		("background", &items.background),
		("snap", &items.snap),
		("cycle_theme_mode", &items.cycle_theme_mode),
	] {
		if let Err(err) = item.set_enabled(visibility) {
			warn!("Failed to update '{}' menu state: {:?}", name, err);
		}
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

pub fn create_tray_menu(
	app: &AppHandle,
	visibility: bool,
	theme_mode: ThemeMode,
) -> Result<(Menu<Wry>, TrayMenuItems)> {
	let menu_item_undo =
		MenuItem::with_id(app, menu_ids::UNDO, "Undo", visibility, Some("CmdOrCtrl+Z"))?;
	let menu_item_redo = MenuItem::with_id(
		app,
		menu_ids::REDO,
		"Redo",
		visibility,
		Some("Shift+CmdOrCtrl+Z"),
	)?;
	let menu_item_clear = MenuItem::with_id(
		app,
		menu_ids::CLEAR,
		"Clear",
		visibility,
		Some("Shift+CmdOrCtrl+C"),
	)?;
	let menu_item_reset = MenuItem::with_id(
		app,
		menu_ids::RESET,
		"Reset",
		visibility,
		Some("CmdOrCtrl+R"),
	)?;
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
	let menu_item_settings =
		MenuItem::with_id(app, menu_ids::SETTINGS, "Settings", true, None::<&str>)?;
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
	let menu_item_cycle_theme_mode = MenuItem::with_id(
		app,
		menu_ids::CYCLE_THEME_MODE,
		theme_mode_label(theme_mode),
		visibility,
		Some("Shift+CmdOrCtrl+M"),
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
			&menu_item_cycle_theme_mode,
			&menu_item_separator,
			&menu_item_hide_canvas,
			&menu_item_quit_canvas,
			&menu_item_separator,
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
		cycle_theme_mode: menu_item_cycle_theme_mode,
		hide_canvas: menu_item_hide_canvas,
		quit_canvas: menu_item_quit_canvas,
	};

	Ok((menu, items))
}

pub fn apply_tray_accelerators_from_settings(
	items: &TrayMenuItems,
	settings: &SettingsSnapshot,
) -> std::result::Result<(), String> {
	let global_actions = &settings.shortcuts.global.actions;
	let history_actions = &settings.shortcuts.canvas.history.actions;
	let toggle_actions = &settings.shortcuts.canvas.toggles.actions;

	let updates = [
		(
			&items.hide_canvas,
			action_primary_binding(global_actions, "toggle_canvas"),
		),
		(
			&items.quit_canvas,
			action_primary_binding(global_actions, "new_canvas"),
		),
		(&items.undo, action_primary_binding(history_actions, "undo")),
		(&items.redo, action_primary_binding(history_actions, "redo")),
		(
			&items.clear,
			action_primary_binding(history_actions, "clear"),
		),
		(
			&items.reset,
			action_primary_binding(history_actions, "reset"),
		),
		(
			&items.toolbar,
			action_primary_binding(toggle_actions, "toolbar"),
		),
		(
			&items.background,
			action_primary_binding(toggle_actions, "background"),
		),
		(&items.snap, action_primary_binding(toggle_actions, "snap")),
		(
			&items.cycle_theme_mode,
			action_primary_binding(toggle_actions, "toggle_theme_mode"),
		),
	];

	let mut errors: Vec<String> = Vec::new();

	for (item, binding) in updates {
		let result = if let Some(binding) = binding {
			let accelerator = binding_to_accelerator(&binding);
			item.set_accelerator(Some(&accelerator))
		} else {
			item.set_accelerator(None::<&str>)
		};

		if let Err(err) = result {
			warn!("Failed to update tray accelerator: {:?}", err);
			errors.push(err.to_string());
		}
	}

	if errors.is_empty() {
		Ok(())
	} else {
		Err(errors.join("; "))
	}
}
