use log::warn;
use tauri::{AppHandle, Manager};
use tauri_plugin_global_shortcut::{
	GlobalShortcutExt, Shortcut, ShortcutState,
};

use crate::{
	ids::events,
	state::AppSettingsState,
};

use super::{
	settings_types::Binding,
	shortcuts_runtime::CompiledShortcuts,
	utils::{handle_event, toggle_window},
};

pub fn init_global_shortcuts(app: &AppHandle) {
	let global_shortcut_plugin = tauri_plugin_global_shortcut::Builder::new().build();
	if let Err(err) = app.app_handle().plugin(global_shortcut_plugin) {
		warn!("Failed to initialize global shortcut plugin: {:?}", err);
	}
}

pub fn reapply_global_shortcuts_with_rollback(
	app: &AppHandle,
	compiled_old: &CompiledShortcuts,
	compiled_new: &CompiledShortcuts,
) -> Result<Vec<Shortcut>, String> {
	let old_shortcuts = global_shortcuts_from_compiled(compiled_old)?;
	let new_shortcuts = global_shortcuts_from_compiled(compiled_new)?;

	if !old_shortcuts.is_empty() {
		app.global_shortcut()
			.unregister_multiple(old_shortcuts.iter().map(|(shortcut, _)| *shortcut).collect::<Vec<_>>())
			.map_err(|err| err.to_string())?;
	}

	match register_global_shortcuts(app, &new_shortcuts) {
		Ok(()) => Ok(new_shortcuts.into_iter().map(|(shortcut, _)| shortcut).collect()),
		Err(err) => {
			let _ = app.global_shortcut().unregister_all();
			if let Err(restore_err) = register_global_shortcuts(app, &old_shortcuts) {
				warn!(
					"Failed to restore global shortcuts after rollback: {:?}",
					restore_err
				);
			}
			Err(err)
		}
	}
}

fn register_global_shortcuts(
	app: &AppHandle,
	entries: &[(Shortcut, String)],
) -> Result<(), String> {
	for (shortcut, action_id) in entries {
		let action_id = action_id.to_string();
		app.global_shortcut()
			.on_shortcut(*shortcut, move |app_handle, _, event| {
				if event.state() != ShortcutState::Pressed {
					return;
				}
				handle_global_action(app_handle, &action_id);
			})
			.map_err(|err| err.to_string())?;
	}

	Ok(())
}

fn global_shortcuts_from_compiled(
	compiled: &CompiledShortcuts,
) -> Result<Vec<(Shortcut, String)>, String> {
	let mut output = Vec::new();
	for (action_id, bindings) in &compiled.actions {
		if !action_id.starts_with("global.") {
			continue;
		}
		for binding in bindings {
			let shortcut = binding_to_global_shortcut(binding)?;
			output.push((shortcut, action_id.to_string()));
		}
	}
	Ok(output)
}

fn binding_to_global_shortcut(binding: &Binding) -> Result<Shortcut, String> {
	let mut tokens: Vec<&str> = Vec::new();
	for modifier in &binding.modifiers {
		let token = match modifier.as_str() {
			"Primary" => "CmdOrCtrl",
			"Shift" => "Shift",
			"Alt" => "Alt",
			"Meta" => "Super",
			"Control" => "Control",
			other => return Err(format!("Unsupported global shortcut modifier: {}", other)),
		};
		tokens.push(token);
	}
	tokens.push(binding.code.as_str());

	let shortcut_str = tokens.join("+");
	shortcut_str
		.parse::<Shortcut>()
		.map_err(|err| format!("Unsupported global shortcut '{}': {}", shortcut_str, err))
}

pub fn is_supported_global_code(code: &str) -> bool {
	code.parse::<Shortcut>().is_ok()
}

fn handle_global_action(app: &AppHandle, action_id: &str) {
	match action_id {
		"global.toggle_canvas" => toggle_window(app),
		"global.new_canvas" => {
			handle_event(app, events::RESET_CANVAS);
			toggle_window(app);
		}
		_ => warn!("Unknown global shortcut action '{}'.", action_id),
	}
}

pub fn apply_compiled_to_runtime_state(app: &AppHandle, compiled: &CompiledShortcuts) {
	let state = app.state::<AppSettingsState>();
	state.set_compiled_shortcuts(compiled.clone());
}
