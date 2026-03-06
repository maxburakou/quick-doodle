use std::collections::HashMap;

use super::settings_types::{Binding, SettingsSnapshot, ShortcutAction};

#[derive(Debug, Clone, Default)]
pub struct CompiledShortcuts {
	pub actions: HashMap<String, Vec<Binding>>,
}

pub fn compile_shortcuts(snapshot: &SettingsSnapshot) -> CompiledShortcuts {
	let mut actions: HashMap<String, Vec<Binding>> = HashMap::new();

	for (action, value) in &snapshot.shortcuts.global.actions {
		actions.insert(format!("global.{}", action), value.bindings.clone());
	}

	for (action, value) in &snapshot.shortcuts.canvas.history.actions {
		actions.insert(format!("canvas.history.{}", action), value.bindings.clone());
	}

	for (action, value) in &snapshot.shortcuts.canvas.clipboard.actions {
		actions.insert(format!("canvas.clipboard.{}", action), value.bindings.clone());
	}

	for (action, value) in &snapshot.shortcuts.canvas.tools.actions {
		actions.insert(format!("canvas.tools.{}", action), value.bindings.clone());
	}

	for (action, value) in &snapshot.shortcuts.canvas.toggles.actions {
		actions.insert(format!("canvas.toggles.{}", action), value.bindings.clone());
	}

	CompiledShortcuts { actions }
}

pub fn canonical_combo_key(binding: &Binding) -> String {
	let mut modifiers = binding
		.modifiers
		.iter()
		.map(|modifier| normalize_modifier(modifier))
		.collect::<Vec<_>>();
	modifiers.sort_unstable();
	format!("{}::{}", modifiers.join("+"), binding.code)
}

pub fn normalize_modifier(modifier: &str) -> String {
	match modifier {
		"Primary" => "Primary".to_string(),
		"Shift" | "shift" => "Shift".to_string(),
		"Alt" | "alt" => "Alt".to_string(),
		"Meta" | "meta" => "Meta".to_string(),
		"Control" | "control" | "Ctrl" | "ctrl" => "Control".to_string(),
		_ => modifier.to_string(),
	}
}

pub fn binding_to_accelerator(binding: &Binding) -> String {
	let mut modifiers = binding
		.modifiers
		.iter()
		.map(|modifier| match normalize_modifier(modifier).as_str() {
			"Primary" => "CmdOrCtrl".to_string(),
			"Shift" => "Shift".to_string(),
			"Alt" => "Alt".to_string(),
			"Meta" => "Super".to_string(),
			"Control" => "Ctrl".to_string(),
			other => other.to_string(),
		})
		.collect::<Vec<_>>();
	modifiers.push(code_to_accelerator_key(&binding.code));
	modifiers.join("+")
}

pub fn action_primary_binding(
	actions: &HashMap<String, ShortcutAction>,
	action: &str,
) -> Option<Binding> {
	actions
		.get(action)
		.and_then(|value| value.bindings.first().cloned())
}

fn code_to_accelerator_key(code: &str) -> String {
	if let Some(letter) = code.strip_prefix("Key") {
		return letter.to_string();
	}

	if let Some(digit) = code.strip_prefix("Digit") {
		return digit.to_string();
	}

	if let Some(digit) = code.strip_prefix("Numpad") {
		return digit.to_string();
	}

	match code {
		"BracketLeft" => "[".to_string(),
		"BracketRight" => "]".to_string(),
		"Backspace" => "Backspace".to_string(),
		"Delete" => "Delete".to_string(),
		_ => code.to_string(),
	}
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::helpers::settings_types::SettingsSnapshot;

	#[test]
	fn compiles_flat_action_map() {
		let snapshot = SettingsSnapshot::defaults();
		let compiled = compile_shortcuts(&snapshot);
		assert!(compiled.actions.contains_key("global.toggle_canvas"));
		assert!(compiled.actions.contains_key("canvas.history.undo"));
		assert!(compiled.actions.contains_key("canvas.tools.tool_1"));
	}
}
