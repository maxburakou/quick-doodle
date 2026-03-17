mod components;
mod helpers;
mod ids;
mod state;

use components::tray::{apply_tray_accelerators_from_settings, create_tray_menu};
use helpers::{
	autostart::{get_autostart_enabled, set_autostart_enabled},
	macos_panel::setup_macos_window_config,
	settings::{
		emit_settings_updated, open_settings_window, register_settings_close_handler,
		settings_get_snapshot, settings_hide_window, settings_restore_defaults, settings_save,
		settings_set_theme_mode, settings_validate_shortcuts,
	},
	settings_store::load_settings,
	shortcuts::{init_global_shortcuts, reapply_global_shortcuts_with_rollback},
	shortcuts_runtime::{compile_shortcuts, CompiledShortcuts},
	utils::{get_icon_path, handle_event, toggle_window, warm_tray_icon_cache, ToggleOutcome},
};
use ids::{events, menu_ids};
use log::warn;
use state::{AppSettingsState, WindowState};
#[cfg_attr(mobile, tauri::mobile_entry_point)]
use tauri::{
	image::Image,
	tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
	Manager,
};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_store;

pub fn run() {
	tauri::Builder::default()
		.plugin(tauri_plugin_store::Builder::new().build())
		.invoke_handler(tauri::generate_handler![
			settings_get_snapshot,
			settings_validate_shortcuts,
			settings_set_theme_mode,
			settings_save,
			settings_restore_defaults,
			settings_hide_window
		])
		.setup(|app| {
			#[cfg(target_os = "macos")]
			setup_macos_window_config(app.handle());

			let window_state = WindowState::new();
			app.manage(window_state);
			warm_tray_icon_cache(app.app_handle());
			register_settings_close_handler(app.app_handle());

			if cfg!(debug_assertions) {
				app.handle().plugin(
					tauri_plugin_log::Builder::default()
						.level(log::LevelFilter::Info)
						.build(),
				)?;
			}

			#[cfg(desktop)]
			if let Err(err) = app.handle().plugin(tauri_plugin_autostart::init(
				MacosLauncher::LaunchAgent,
				Some(vec!["--flag1", "--flag2"]),
			)) {
				warn!("Failed to initialize autostart plugin: {:?}", err);
			}

			let snapshot = load_settings(app.app_handle())?;
			if let Ok(enabled) = get_autostart_enabled(app.app_handle()) {
				if enabled != snapshot.autostart.enabled {
					warn!(
						"Autostart state differs from settings (os={}, settings={}), syncing.",
						enabled, snapshot.autostart.enabled
					);
				}
			}
			if let Err(err) = set_autostart_enabled(app.app_handle(), snapshot.autostart.enabled) {
				warn!("Failed to sync autostart status on setup: {}", err);
			}

			let compiled = compile_shortcuts(&snapshot);
			app.manage(AppSettingsState::new(snapshot.clone(), compiled.clone()));

			let (tray_menu, tray_menu_items) =
				create_tray_menu(app.app_handle(), false, snapshot.theme.mode)?;

			let tray_icon = TrayIconBuilder::new()
				.menu(&tray_menu)
				.show_menu_on_left_click(false)
				.on_menu_event(|app, event| match event.id.as_ref() {
					menu_ids::QUIT => app.exit(0),
					menu_ids::RESET => handle_event(app, events::RESET_CANVAS),
					menu_ids::CLEAR => handle_event(app, events::CLEAR_CANVAS),
					menu_ids::UNDO => handle_event(app, events::UNDO_CANVAS),
					menu_ids::REDO => handle_event(app, events::REDO_CANVAS),
					menu_ids::HIDE_CANVAS => {
						let _ = toggle_window(app);
					}
					menu_ids::QUIT_CANVAS => {
						if let ToggleOutcome::Toggled(_) = toggle_window(app) {
							handle_event(app, events::RESET_CANVAS);
						}
					}
					menu_ids::SETTINGS => open_settings_window(app),
					menu_ids::BACKGROUND => handle_event(app, events::TOGGLE_BACKGROUND_CANVAS),
					menu_ids::TOOLBAR => handle_event(app, events::TOGGLE_TOOLBAR_CANVAS),
					menu_ids::SNAP => handle_event(app, events::TOGGLE_SNAP_CANVAS),
					menu_ids::CYCLE_THEME_MODE => handle_event(app, events::TOGGLE_THEME_CANVAS),
					&_ => {}
				})
				.icon(Image::from_path(get_icon_path(
					&app.app_handle(),
					"tray_icon--inactive.png",
				))?)
				.icon_as_template(true)
				.on_tray_icon_event(|tray, event| {
					if let TrayIconEvent::Click {
						button: MouseButton::Left,
						button_state: MouseButtonState::Up,
						..
					} = event
					{
						let _ = toggle_window(&tray.app_handle());
					}
				})
				.build(app)?;

			{
				let state = app.state::<WindowState>();
				state.set_tray_icon(tray_icon);
				state.set_tray_menu_items(tray_menu_items);
			}

			if let Err(err) = app
				.state::<WindowState>()
				.with_tray_menu_items(|menu_items| {
					if let Some(menu_items) = menu_items {
						apply_tray_accelerators_from_settings(menu_items, &snapshot)
					} else {
						Ok(())
					}
				}) {
				warn!("Failed to apply initial tray accelerators: {}", err);
			}

			init_global_shortcuts(app.app_handle());
			let empty_compiled = CompiledShortcuts::default();
			if let Err(err) =
				reapply_global_shortcuts_with_rollback(app.app_handle(), &empty_compiled, &compiled)
			{
				warn!("Failed to apply initial global shortcuts: {}", err);
			}

			emit_settings_updated(app.app_handle(), &snapshot);

			Ok(())
		})
		.run(tauri::generate_context!())
		.expect("error while running tauri application");
}
