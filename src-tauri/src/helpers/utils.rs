#[allow(deprecated)]
use cocoa::{
	appkit::NSWindowCollectionBehavior,
	base::id,
	foundation::{NSPoint, NSRect, NSSize},
};
use objc::{msg_send, sel, sel_impl};
use std::path::PathBuf;
use tauri::{
	image::Image, ActivationPolicy::Accessory, AppHandle, Emitter, Manager, WebviewWindow,
};
use tauri_nspanel::{panel_delegate, ManagerExt, WebviewWindowExt};

use crate::{components::tray::create_tray_menu, state::WindowState};

pub fn get_icon_path(app: &AppHandle, icon_name: &str) -> PathBuf {
	app.path()
		.resource_dir()
		.expect("Failed to get resource directory")
		.join(format!("icons/tray/{}", icon_name))
}

pub fn handle_event(app: &AppHandle, event_name: &str) {
	if let Some(window) = app.get_webview_window("main") {
		eprintln!("EVENT: {}", event_name);
		let _ = window.emit(event_name, {}).map_err(|e| {
			eprintln!("Error emitting {}: {:?}", event_name, e);
		});
	}
}

pub fn toggle_window(app: &AppHandle) {
	let state = app.state::<WindowState>();
	let mut is_visible = state.is_visible.lock().unwrap();
	let tray_icon = state.tray_icon.lock().unwrap();

	if let Some(window) = app.get_webview_window("main") {
		let new_menu = create_tray_menu(app, !*is_visible).unwrap();
		if *is_visible {
			let _ = window.hide();
			if let Some(ref tray) = *tray_icon {
				let _ = tray.set_icon(Some(
					Image::from_path(get_icon_path(app, "tray_icon--inactive.png")).unwrap(),
				));
				let _ = tray.set_icon_as_template(true);
				let _ = tray.set_menu(Some(new_menu));
			}
		} else {
			let _ = window.show();
			let _ = window.set_focus();
			if let Some(ref tray) = *tray_icon {
				let _ = tray.set_icon(Some(
					Image::from_path(get_icon_path(app, "tray_icon--active.png")).unwrap(),
				));
				let _ = tray.set_icon_as_template(false);
				let _ = tray.set_menu(Some(new_menu));
			}
		}
		*is_visible = !*is_visible;
	}
}

#[cfg(target_os = "macos")]
pub fn maximize_over_dock(window: &tauri::WebviewWindow) {
	unsafe {
		if let Ok(raw) = window.ns_window() {
			let ns_window: id = raw as id;
			let screen: id = msg_send![ns_window, screen];

			if screen != std::ptr::null_mut() {
				let full_frame: NSRect = msg_send![screen, frame];
				let visible_frame: NSRect = msg_send![screen, visibleFrame];

				let menu_bar_height = (full_frame.origin.y + full_frame.size.height)
					- (visible_frame.origin.y + visible_frame.size.height);

				let new_frame = NSRect::new(
					NSPoint::new(full_frame.origin.x, full_frame.origin.y),
					NSSize::new(
						full_frame.size.width,
						full_frame.size.height - menu_bar_height,
					),
				);

				let _: () = msg_send![ns_window, setFrame: new_frame display: true];
			}
		}
	}
}

pub fn setup_macos_window_config(app: &AppHandle) {
	let _ = app.plugin(tauri_nspanel::init());
	let _ = app.set_activation_policy(Accessory);

	let window: WebviewWindow = app.get_webview_window("main").unwrap();

	let panel = window.to_panel().unwrap();

	let delegate = panel_delegate!(MyPanelDelegate {
		window_did_become_key,
		window_did_resign_key
	});

	delegate.set_listener(Box::new(move |delegate_name: String| {
		match delegate_name.as_str() {
			"window_did_become_key" => {
				println!("[info]: panel becomes key window!");
			}
			"window_did_resign_key" => {
				println!("[info]: panel resigned from key window!");
			}
			_ => (),
		}
	}));

	const NS_FLOAT_WINDOW_LEVEL: i32 = 21;
	panel.set_level(NS_FLOAT_WINDOW_LEVEL);

	const NS_WINDOW_STYLE_MASK: i32 = 1 << 7;
	// Ensures the panel cannot activate the app
	panel.set_style_mask(NS_WINDOW_STYLE_MASK);

	// Allows the panel to:
	// - display on the same space as the full screen window
	// - join all spaces
	#[allow(deprecated)]
	panel.set_collection_behaviour(
		NSWindowCollectionBehavior::NSWindowCollectionBehaviorFullScreenAuxiliary
			| NSWindowCollectionBehavior::NSWindowCollectionBehaviorCanJoinAllSpaces,
	);

	panel.set_delegate(delegate);
	maximize_over_dock(&window);
}

#[tauri::command]
fn show_panel(handle: AppHandle) {
	let panel = handle.get_webview_panel("main").unwrap();

	panel.show();
}

#[tauri::command]
fn hide_panel(handle: AppHandle) {
	let panel = handle.get_webview_panel("main").unwrap();

	panel.order_out(None);
}

#[tauri::command]
fn close_panel(handle: AppHandle) {
	let panel = handle.get_webview_panel("main").unwrap();

	panel.set_released_when_closed(true);

	panel.close();
}
