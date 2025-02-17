mod helpers;
#[cfg_attr(mobile, tauri::mobile_entry_point)]
use tauri::{
    image::Image,
    tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
    ActivationPolicy::Accessory,
    Manager, AppHandle
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use tauri_plugin_autostart::MacosLauncher;
use std::sync::{Arc, Mutex};
use helpers::{
    autostart::toggle_autostart, 
    events::handle_event, 
    utils::get_icon_path, 
    tray::create_tray_menu
};

// Define the state
struct WindowState {
    is_visible: Mutex<bool>,
    tray_icon: Arc<Mutex<Option<TrayIcon>>>,
}

impl WindowState {
    fn new() -> Self {
        Self {
            is_visible: Mutex::new(false),
            tray_icon: Arc::new(Mutex::new(None)),
        }
    }
}

fn toggle_window(app: &AppHandle) {
    let state = app.state::<WindowState>();
    let mut is_visible = state.is_visible.lock().unwrap();
    let tray_icon = state.tray_icon.lock().unwrap();

    if let Some(window) = app.get_webview_window("main") {
        let new_menu = create_tray_menu(app, !*is_visible).unwrap();
        if *is_visible {
            let _ = window.hide();
            if let Some(ref tray) = *tray_icon {
                let _ = tray.set_icon(Some(Image::from_path(get_icon_path(app, "tray_icon--inactive.png")).unwrap()));
                let _ = tray.set_icon_as_template(true);
                let _ = tray.set_menu(Some(new_menu));
            }
        } else {
            let _ = window.show();
            let _ = window.set_focus();
            if let Some(ref tray) = *tray_icon {
                let _ = tray.set_icon(Some(Image::from_path(get_icon_path(app, "tray_icon--active.png")).unwrap()));
                let _ = tray.set_icon_as_template(false);
                let _ = tray.set_menu(Some(new_menu));
            }
        }
        *is_visible = !*is_visible;
    }
}

pub fn run() {
    tauri::Builder::default()
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
                .on_menu_event(|app, event| {
                  match event.id.as_ref() {
                      "quit" => app.exit(0),
                      "reset" => handle_event(app, "reset-canvas"),
                      "clear" => handle_event(app, "clear-canvas"),
                      "undo" => handle_event(app, "undo-canvas"),
                      "redo" => handle_event(app, "redo-canvas"),
                      "hide_canvas" => toggle_window(app),
                      "quit_canvas" => {
                          toggle_window(app);
                          handle_event(app, "reset-canvas");
                      },
                      "autostart" => toggle_autostart(app),
                      &_ => {}
                  }
                })
                .icon(Image::from_path(get_icon_path(&app.app_handle(), "tray_icon--inactive.png"))?)
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

            // Store tray icon in state correctly
            {
                let state = app.state::<WindowState>();
                let mut tray_lock = state.tray_icon.lock().unwrap();
                *tray_lock = Some(tray_icon);
            }

            // Define shortcuts
            #[cfg(target_os = "macos")]
            let ctrl_s_shortcut = Shortcut::new(Some(Modifiers::SHIFT | Modifiers::SUPER), Code::KeyS);
  
            #[cfg(not(target_os = "macos"))]
            let ctrl_s_shortcut = Shortcut::new(Some(Modifiers::SHIFT | Modifiers::CONTROL), Code::KeyS);

            #[cfg(target_os = "macos")]
            let ctrl_d_shortcut = Shortcut::new(Some(Modifiers::SHIFT | Modifiers::SUPER), Code::KeyD);

            #[cfg(not(target_os = "macos"))]
            let ctrl_d_shortcut = Shortcut::new(Some(Modifiers::SHIFT | Modifiers::CONTROL), Code::KeyD);

            let global_shortcut_plugin = tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        if shortcut == &ctrl_s_shortcut {
                            toggle_window(app);
                        } else if shortcut == &ctrl_d_shortcut {
                            handle_event(app, "reset-canvas");
                            toggle_window(app);
                        }
                    }
                })
                .build();

            app.handle().plugin(global_shortcut_plugin)?;
            app.global_shortcut().register(ctrl_s_shortcut)?;
            app.global_shortcut().register(ctrl_d_shortcut)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
