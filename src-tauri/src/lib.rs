mod components;
mod helpers;
mod state;
use components::tray::create_tray_menu;
use helpers::{
	autostart::toggle_autostart,
	shortcuts::register_global_shortcuts,
	utils::{get_icon_path, handle_event, toggle_window},
};
use state::WindowState;
#[cfg_attr(mobile, tauri::mobile_entry_point)]
use tauri::{
	image::Image,
	tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
	ActivationPolicy::Accessory,
	Manager,
};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_store;

pub fn run() {
	tauri::Builder::default()
		.plugin(tauri_plugin_store::Builder::new().build())
		.setup(|app| {
			// Hide dock icon on macOS
			#[cfg(target_os = "macos")]
			app.set_activation_policy(Accessory);

			// Initialize state
			let state = WindowState::new();
			app.manage(state);

			if cfg!(debug_assertions) {
				app.handle().plugin(
					tauri_plugin_log::Builder::default()
						.level(log::LevelFilter::Info)
						.build(),
				)?;
			}

			#[cfg(desktop)]
			let _ = app.handle().plugin(tauri_plugin_autostart::init(
				MacosLauncher::LaunchAgent,
				Some(vec!["--flag1", "--flag2"]),
			));

			// Tray menu items
			let tray_menu = create_tray_menu(app.app_handle(), false)?;

			// Create tray icon
			let tray_icon = TrayIconBuilder::new()
				.menu(&tray_menu)
				.show_menu_on_left_click(false)
				.on_menu_event(|app, event| match event.id.as_ref() {
					"quit" => app.exit(0),
					"reset" => handle_event(app, "reset-canvas"),
					"clear" => handle_event(app, "clear-canvas"),
					"undo" => handle_event(app, "undo-canvas"),
					"redo" => handle_event(app, "redo-canvas"),
					"hide_canvas" => toggle_window(app),
					"quit_canvas" => {
						toggle_window(app);
						handle_event(app, "reset-canvas");
					}
					"autostart" => toggle_autostart(app),
					"background" => handle_event(app, "toggle-background-canvas"),
					"toolbar" => handle_event(app, "toggle-toolbar-canvas"),
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
						handle_event(&tray.app_handle(), "reset-canvas");
					}
				})
				.build(app)?;

			// Store tray icon in state
			{
				let state = app.state::<WindowState>();
				let mut tray_lock = state.tray_icon.lock().unwrap();
				*tray_lock = Some(tray_icon);
			}

			register_global_shortcuts(app.app_handle());
      let window = app.get_webview_window("main").unwrap();
      window.open_devtools();

			Ok(())
		})
		.plugin(tauri_plugin_store::Builder::default().build())
		.run(tauri::generate_context!())
		.expect("error while running tauri application");
}
