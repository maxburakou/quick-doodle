#[cfg_attr(mobile, tauri::mobile_entry_point)]

use tauri::{
  image::Image,
  Manager,
  menu::{Menu, MenuItem},
  tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent}
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
      let tray_quit_icon = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
      // Tray menu
      let tray_menu = Menu::with_items(app, &[&tray_quit_icon])?;
      // Tray icon images
      let tray_default_image = Image::from_path("./icons/icon.png")?;
      let tray_active_image = Image::from_path("./icons/tray/tray_icon--active.png")?;
      let tray_inactive_image = Image::from_path("./icons/tray/tray_icon--inactive.png")?;
      // Tray icon
      let _tray_icon = TrayIconBuilder::new()
        .menu(&tray_menu)
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
        .icon(tray_default_image.clone())
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
                      let _ = tray.set_icon(Some(tray_inactive_image.clone()));
                  } else {
                      // Show and focus the window
                      let _ = window.show();
                      let _ = window.set_focus();
                      let _ = tray.set_icon(Some(tray_active_image.clone()));
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
