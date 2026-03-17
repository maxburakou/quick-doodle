use log::{info, warn};
use tauri::AppHandle;

#[cfg(target_os = "macos")]
#[allow(deprecated)]
use cocoa::{
	appkit::NSWindowCollectionBehavior,
	base::id,
	foundation::{NSPoint, NSRect, NSSize},
};
#[cfg(target_os = "macos")]
use objc::{msg_send, sel, sel_impl};
#[cfg(target_os = "macos")]
use tauri::{ActivationPolicy::Accessory, Manager, WebviewWindow};
#[cfg(target_os = "macos")]
use tauri_nspanel::{panel_delegate, WebviewWindowExt};

use crate::ids::window_labels;

#[cfg(target_os = "macos")]
fn maximize_over_dock(window: &tauri::WebviewWindow) {
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

#[cfg(target_os = "macos")]
pub fn setup_macos_window_config(app: &AppHandle) {
	if let Err(err) = app.plugin(tauri_nspanel::init()) {
		warn!("Failed to initialize nspanel plugin: {:?}", err);
	}
	if let Err(err) = app.set_activation_policy(Accessory) {
		warn!("Failed to set accessory activation policy: {:?}", err);
	}
	if let Err(err) = app.show() {
		warn!("Failed to show app for startup activation on macOS: {:?}", err);
	}

	let Some(window): Option<WebviewWindow> = app.get_webview_window(window_labels::MAIN) else {
		warn!(
			"Main window with label '{}' was not found during macOS setup.",
			window_labels::MAIN
		);
		return;
	};

	let Ok(panel) = window.to_panel() else {
		warn!("Failed to convert main window into macOS panel.");
		return;
	};

	let delegate = panel_delegate!(MyPanelDelegate {
		window_did_become_key,
		window_did_resign_key
	});

	delegate.set_listener(Box::new(move |delegate_name: String| {
		match delegate_name.as_str() {
			"window_did_become_key" => {
				info!("[info]: panel becomes key window!");
			}
			"window_did_resign_key" => {
				info!("[info]: panel resigned from key window!");
			}
			_ => (),
		}
	}));

	const NS_FLOAT_WINDOW_LEVEL: i32 = 2;
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

#[cfg(not(target_os = "macos"))]
pub fn setup_macos_window_config(_: &AppHandle) {}
