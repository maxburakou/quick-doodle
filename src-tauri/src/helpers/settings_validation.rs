use std::collections::{HashMap, HashSet};

use super::{
	shortcuts::is_supported_global_code,
	settings_types::{Binding, SettingsSnapshot, ValidationIssue},
	shortcuts_runtime::{canonical_combo_key, compile_shortcuts, normalize_modifier},
};

pub fn validate_shortcuts(snapshot: &SettingsSnapshot) -> Vec<ValidationIssue> {
	let mut issues: Vec<ValidationIssue> = Vec::new();
	let compiled = compile_shortcuts(snapshot);
	let mut combo_to_paths: HashMap<String, Vec<String>> = HashMap::new();
	let reserved_combo = canonical_combo_key(&Binding {
		code: "KeyQ".to_string(),
		modifiers: vec!["Primary".to_string()],
	});

	for (action_id, bindings) in compiled.actions {
		for (idx, binding) in bindings.iter().enumerate() {
			let path = binding_path_from_action(&action_id, idx);

			if binding.code.trim().is_empty() {
				issues.push(ValidationIssue {
					path: path.clone(),
					kind: "invalid_key".to_string(),
					message: "Code cannot be empty".to_string(),
				});
				continue;
			}

			let mut uniq = HashSet::new();
			for modifier in &binding.modifiers {
				let normalized = normalize_modifier(modifier);
				if !matches!(
					normalized.as_str(),
					"Primary" | "Shift" | "Alt" | "Meta" | "Control"
				) {
					issues.push(ValidationIssue {
						path: path.clone(),
						kind: "invalid_key".to_string(),
						message: format!("Unsupported modifier: {}", modifier),
					});
				}
				if !uniq.insert(normalized.clone()) {
					issues.push(ValidationIssue {
						path: path.clone(),
						kind: "invalid_key".to_string(),
						message: format!("Duplicate modifier: {}", normalized),
					});
				}
			}

			if action_id.starts_with("global.") {
				let require_primary = snapshot.shortcuts.policy.global.require_primary;
				let allow_single_modifier = snapshot.shortcuts.policy.global.allow_single_modifier;
				let normalized = binding
					.modifiers
					.iter()
					.map(|modifier| normalize_modifier(modifier))
					.collect::<HashSet<_>>();

				if require_primary && !normalized.contains("Primary") {
					issues.push(ValidationIssue {
						path: path.clone(),
						kind: "policy".to_string(),
						message: "Global shortcut must include Primary modifier".to_string(),
					});
				}

				if !allow_single_modifier && is_modifier_key(&binding.code) {
					issues.push(ValidationIssue {
						path: path.clone(),
						kind: "policy".to_string(),
						message: "Modifier-only keys are not allowed for global shortcuts"
							.to_string(),
					});
				}

				if !is_supported_global_code(&binding.code) {
					issues.push(ValidationIssue {
						path: path.clone(),
						kind: "invalid_key".to_string(),
						message: format!(
							"Unsupported global key code for registration: {}",
							binding.code
						),
					});
				}
			}

			let canonical = canonical_combo_key(binding);
			if canonical == reserved_combo {
				issues.push(ValidationIssue {
					path: path.clone(),
					kind: "reserved".to_string(),
					message: "Primary+KeyQ is reserved".to_string(),
				});
			}

			combo_to_paths.entry(canonical).or_default().push(path);
		}
	}

	for paths in combo_to_paths.values_mut() {
		paths.sort();
		if paths.len() < 2 {
			continue;
		}

		for path in paths.iter() {
			let conflicting_paths = paths
				.iter()
				.filter(|other| *other != path)
				.cloned()
				.collect::<Vec<_>>()
				.join(", ");
			issues.push(ValidationIssue {
				path: path.clone(),
				kind: "conflict".to_string(),
				message: format!("Duplicate shortcut. Conflicts with {}", conflicting_paths),
			});
		}
	}

	issues
}

fn is_modifier_key(code: &str) -> bool {
	matches!(
		code,
		"ShiftLeft"
			| "ShiftRight"
			| "ControlLeft"
			| "ControlRight"
			| "AltLeft"
			| "AltRight"
			| "MetaLeft"
			| "MetaRight"
	)
}

fn binding_path_from_action(action_id: &str, idx: usize) -> String {
	if let Some(action) = action_id.strip_prefix("global.") {
		return format!("shortcuts.global.actions.{}.bindings[{}]", action, idx);
	}

	for prefix in [
		"canvas.history.",
		"canvas.clipboard.",
		"canvas.tools.",
		"canvas.toggles.",
	] {
		if let Some(action) = action_id.strip_prefix(prefix) {
			let group = prefix.trim_end_matches('.').split('.').nth(1).unwrap_or("history");
			return format!(
				"shortcuts.canvas.{}.actions.{}.bindings[{}]",
				group, action, idx
			);
		}
	}

	format!("shortcuts.{}.bindings[{}]", action_id, idx)
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::helpers::settings_types::SettingsSnapshot;

	#[test]
	fn validates_reserved_shortcut() {
		let mut snapshot = SettingsSnapshot::defaults();
		snapshot.shortcuts.global.actions.insert(
			"toggle_canvas".to_string(),
			crate::helpers::settings_types::ShortcutAction {
				bindings: vec![Binding {
					code: "KeyQ".to_string(),
					modifiers: vec!["Primary".to_string()],
				}],
			},
		);

		let issues = validate_shortcuts(&snapshot);
		assert!(issues.iter().any(|issue| issue.kind == "reserved"));
	}
}
