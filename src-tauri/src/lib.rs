use tauri::Emitter;
#[cfg_attr(mobile, tauri::mobile_entry_point)]
use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
    Manager, AppHandle, WebviewWindow,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use std::sync::{Arc, Mutex};

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
        if *is_visible {
            let _ = window.hide();
            if let Some(ref tray) = *tray_icon {
                let _ = tray.set_icon(Some(Image::from_path("./icons/tray/tray_icon--inactive.png").unwrap()));
            }
        } else {
            let _ = window.show();
            let _ = window.set_focus();
            if let Some(ref tray) = *tray_icon {
                let _ = tray.set_icon(Some(Image::from_path("./icons/tray/tray_icon--active.png").unwrap()));
            }
        }
        *is_visible = !*is_visible;
    }
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Initialize state
            let state = WindowState::new();
            app.manage(state);

            // Hide dock icon on macOS
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Create tray menu
            let tray_quit_icon = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let tray_menu = Menu::with_items(app, &[&tray_quit_icon])?;

            // Create tray icon
            let tray_icon = TrayIconBuilder::new()
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| {
                    if event.id.as_ref() == "quit" {
                        app.exit(0);
                    }
                })
                .icon(Image::from_path("./icons/tray/tray_icon--inactive.png")?)
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_window(&tray.app_handle());
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
                            toggle_window(app);
                            if let Some(window) = app.get_webview_window("main") {
                                eprintln!("EVENT: reset-canvas");
                                let _ = window.emit("reset-canvas", {}).map_err(|e| {
                                    eprintln!("Error emitting reset-canvas: {:?}", e);
                                });
                            }
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
