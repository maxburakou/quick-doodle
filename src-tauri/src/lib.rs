mod components;
mod helpers;
mod ids;
mod state;
use components::tray::create_tray_menu;
use helpers::{
	autostart::toggle_autostart,
	macos_panel::setup_macos_window_config,
	settings::{open_settings_window, register_settings_close_handler},
	shortcuts::register_global_shortcuts,
	utils::{get_icon_path, handle_event, toggle_window, warm_tray_icon_cache},
};
use ids::{events, menu_ids};
use log::warn;
use state::WindowState;
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
		.setup(|app| {
			#[cfg(target_os = "macos")]
			setup_macos_window_config(app.handle());

			// Initialize state
			let state = state::WindowState::new();
			app.manage(state);
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

			// Tray menu items
			let (tray_menu, tray_menu_items) = create_tray_menu(app.app_handle(), false)?;

			// Create tray icon
				let tray_icon = TrayIconBuilder::new()
				.menu(&tray_menu)
				.show_menu_on_left_click(false)
				.on_menu_event(|app, event| match event.id.as_ref() {
					menu_ids::QUIT => app.exit(0),
					menu_ids::RESET => handle_event(app, events::RESET_CANVAS),
					menu_ids::CLEAR => handle_event(app, events::CLEAR_CANVAS),
					menu_ids::UNDO => handle_event(app, events::UNDO_CANVAS),
					menu_ids::REDO => handle_event(app, events::REDO_CANVAS),
					menu_ids::HIDE_CANVAS => toggle_window(app),
					menu_ids::QUIT_CANVAS => {
						toggle_window(app);
						handle_event(app, events::RESET_CANVAS);
					}
					menu_ids::AUTOSTART => toggle_autostart(app),
					menu_ids::SETTINGS => open_settings_window(app),
					menu_ids::BACKGROUND => handle_event(app, events::TOGGLE_BACKGROUND_CANVAS),
					menu_ids::TOOLBAR => handle_event(app, events::TOGGLE_TOOLBAR_CANVAS),
					menu_ids::SNAP => handle_event(app, events::TOGGLE_SNAP_CANVAS),
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
							toggle_window(&tray.app_handle());
							handle_event(&tray.app_handle(), events::RESET_CANVAS);
						}
					})
				.build(app)?;

			// Store tray icon in state
			{
				let state = app.state::<WindowState>();
				state.set_tray_icon(tray_icon);
				state.set_tray_menu_items(tray_menu_items);
			}

			register_global_shortcuts(app.app_handle());

			Ok(())
		})
		.run(tauri::generate_context!())
		.expect("error while running tauri application");
}
