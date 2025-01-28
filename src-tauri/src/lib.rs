#[cfg_attr(mobile, tauri::mobile_entry_point)]

use tauri::{
  Manager,
  menu::{Menu, MenuItem},
  tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

use std::sync::Mutex;

// Define the state
struct WindowState(Mutex<bool>);

pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      // Initialize the window state
      app.manage(WindowState(Mutex::new(false)));
      // Hide the dock icon on macOS
      #[cfg(target_os = "macos")]
      app.set_activation_policy(tauri::ActivationPolicy::Accessory);

      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      // Quit menu item
      let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
      // Tray menu
      let menu = Menu::with_items(app, &[&quit_i])?;
      // Tray
      let _tray = TrayIconBuilder::new()
        .menu(&menu)
        // Left click config for tray icon
        .show_menu_on_left_click(false)
        // Menu events
        .on_menu_event(|app, event| match event.id.as_ref() {
          "quit" => {
            app.exit(0);
          }
          _ => {
            println!("menu item {:?} not handled", event.id);
          }
        })
        // Tray icon
        .icon(app.default_window_icon().unwrap().clone())
        .on_tray_icon_event(move |tray, event| match event {
          TrayIconEvent::Click {
              button: MouseButton::Left,
              button_state: MouseButtonState::Up,
              ..
          } => {
              let app = tray.app_handle();
              let window_state = app.state::<WindowState>();
              let mut is_visible = window_state.0.lock().unwrap();

              if let Some(window) = app.get_webview_window("main") {
                  if *is_visible {
                      // Hide the window
                      let _ = window.hide();
                  } else {
                      // Show and focus the window
                      let _ = window.show();
                      let _ = window.set_focus();
                  }
                  // Toggle the state
                  *is_visible = !*is_visible;
              }
          }
          _ => {
              println!("unhandled event {event:?}");
          }
        })
        .build(app)?;
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
