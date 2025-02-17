use tauri::{AppHandle, Manager};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

use super::utils::{handle_event, toggle_window};

pub fn register_global_shortcuts(app: &AppHandle) {
    // Define shortcuts
    #[cfg(target_os = "macos")]
    let ctrl_s_shortcut = Shortcut::new(Some(Modifiers::SHIFT | Modifiers::SUPER), Code::KeyS);

    #[cfg(not(target_os = "macos"))]
    let ctrl_s_shortcut = Shortcut::new(Some(Modifiers::SHIFT | Modifiers::CONTROL), Code::KeyS);

    #[cfg(target_os = "macos")]
    let ctrl_d_shortcut = Shortcut::new(Some(Modifiers::SHIFT | Modifiers::SUPER), Code::KeyD);

    #[cfg(not(target_os = "macos"))]
    let ctrl_d_shortcut = Shortcut::new(Some(Modifiers::SHIFT | Modifiers::CONTROL), Code::KeyD);

    let global_shortcut_plugin =  
        tauri_plugin_global_shortcut::Builder::new()
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

    let _ = app.app_handle().plugin(global_shortcut_plugin);
    let _ = app.global_shortcut().register(ctrl_s_shortcut);
    let _ = app.global_shortcut().register(ctrl_d_shortcut);

}