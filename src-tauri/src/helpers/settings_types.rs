use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub const SETTINGS_SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingsSnapshot {
	pub schema_version: u32,
	pub autostart: AutostartSettings,
	pub shortcuts: ShortcutsConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutostartSettings {
	pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShortcutsConfig {
	pub policy: ShortcutPolicy,
	pub global: ShortcutScope,
	pub canvas: CanvasShortcuts,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShortcutPolicy {
	pub conflicts: ConflictsPolicy,
	pub global: GlobalPolicy,
	pub canvas: CanvasPolicy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConflictsPolicy {
	pub mode: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlobalPolicy {
	pub require_primary: bool,
	pub allow_single_modifier: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasPolicy {
	pub allow_single_key: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShortcutScope {
	pub actions: HashMap<String, ShortcutAction>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasShortcuts {
	pub history: ShortcutScope,
	pub tools: ShortcutScope,
	pub toggles: ShortcutScope,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShortcutAction {
	pub bindings: Vec<Binding>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Binding {
	pub code: String,
	pub modifiers: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationIssue {
	pub path: String,
	pub kind: String,
	pub message: String,
}

impl SettingsSnapshot {
	pub fn defaults() -> Self {
		Self {
			schema_version: SETTINGS_SCHEMA_VERSION,
			autostart: AutostartSettings { enabled: false },
			shortcuts: ShortcutsConfig {
				policy: ShortcutPolicy {
					conflicts: ConflictsPolicy {
						mode: "disallow_duplicates".to_string(),
					},
					global: GlobalPolicy {
						require_primary: true,
						allow_single_modifier: false,
					},
					canvas: CanvasPolicy {
						allow_single_key: true,
					},
				},
				global: ShortcutScope {
					actions: HashMap::from([
						(
							"toggle_canvas".to_string(),
							ShortcutAction {
								bindings: vec![Binding {
									code: "KeyS".to_string(),
									modifiers: vec!["Primary".to_string(), "Shift".to_string()],
								}],
							},
						),
						(
							"new_canvas".to_string(),
							ShortcutAction {
								bindings: vec![Binding {
									code: "KeyD".to_string(),
									modifiers: vec!["Primary".to_string(), "Shift".to_string()],
								}],
							},
						),
					]),
				},
				canvas: CanvasShortcuts {
					history: ShortcutScope {
						actions: HashMap::from([
							(
								"undo".to_string(),
								ShortcutAction {
									bindings: vec![Binding {
										code: "KeyZ".to_string(),
										modifiers: vec!["Primary".to_string()],
									}],
								},
							),
							(
								"redo".to_string(),
								ShortcutAction {
									bindings: vec![Binding {
										code: "KeyZ".to_string(),
										modifiers: vec!["Primary".to_string(), "Shift".to_string()],
									}],
								},
							),
							(
								"clear".to_string(),
								ShortcutAction {
									bindings: vec![Binding {
										code: "KeyC".to_string(),
										modifiers: vec!["Primary".to_string()],
									}],
								},
							),
							(
								"reset".to_string(),
								ShortcutAction {
									bindings: vec![Binding {
										code: "KeyR".to_string(),
										modifiers: vec!["Primary".to_string()],
									}],
								},
							),
						]),
					},
					tools: ShortcutScope {
						actions: HashMap::from([
							(
								"tool_1".to_string(),
								ShortcutAction {
									bindings: vec![
										Binding {
											code: "Digit1".to_string(),
											modifiers: vec![],
										},
										Binding {
											code: "Numpad1".to_string(),
											modifiers: vec![],
										},
									],
								},
							),
							(
								"tool_2".to_string(),
								ShortcutAction {
									bindings: vec![
										Binding {
											code: "Digit2".to_string(),
											modifiers: vec![],
										},
										Binding {
											code: "Numpad2".to_string(),
											modifiers: vec![],
										},
									],
								},
							),
							(
								"tool_3".to_string(),
								ShortcutAction {
									bindings: vec![
										Binding {
											code: "Digit3".to_string(),
											modifiers: vec![],
										},
										Binding {
											code: "Numpad3".to_string(),
											modifiers: vec![],
										},
									],
								},
							),
							(
								"tool_4".to_string(),
								ShortcutAction {
									bindings: vec![
										Binding {
											code: "Digit4".to_string(),
											modifiers: vec![],
										},
										Binding {
											code: "Numpad4".to_string(),
											modifiers: vec![],
										},
									],
								},
							),
							(
								"tool_5".to_string(),
								ShortcutAction {
									bindings: vec![
										Binding {
											code: "Digit5".to_string(),
											modifiers: vec![],
										},
										Binding {
											code: "Numpad5".to_string(),
											modifiers: vec![],
										},
									],
								},
							),
							(
								"tool_6".to_string(),
								ShortcutAction {
									bindings: vec![
										Binding {
											code: "Digit6".to_string(),
											modifiers: vec![],
										},
										Binding {
											code: "Numpad6".to_string(),
											modifiers: vec![],
										},
									],
								},
							),
							(
								"tool_7".to_string(),
								ShortcutAction {
									bindings: vec![
										Binding {
											code: "Digit7".to_string(),
											modifiers: vec![],
										},
										Binding {
											code: "Numpad7".to_string(),
											modifiers: vec![],
										},
									],
								},
							),
							(
								"tool_8".to_string(),
								ShortcutAction {
									bindings: vec![
										Binding {
											code: "Digit8".to_string(),
											modifiers: vec![],
										},
										Binding {
											code: "Numpad8".to_string(),
											modifiers: vec![],
										},
									],
								},
							),
							(
								"tool_9".to_string(),
								ShortcutAction {
									bindings: vec![
										Binding {
											code: "Digit9".to_string(),
											modifiers: vec![],
										},
										Binding {
											code: "Numpad9".to_string(),
											modifiers: vec![],
										},
									],
								},
							),
						]),
					},
					toggles: ShortcutScope {
						actions: HashMap::from([
							(
								"toolbar".to_string(),
								ShortcutAction {
									bindings: vec![Binding {
										code: "KeyT".to_string(),
										modifiers: vec!["Primary".to_string()],
									}],
								},
							),
							(
								"background".to_string(),
								ShortcutAction {
									bindings: vec![Binding {
										code: "KeyA".to_string(),
										modifiers: vec!["Primary".to_string()],
									}],
								},
							),
							(
								"snap".to_string(),
								ShortcutAction {
									bindings: vec![Binding {
										code: "KeyE".to_string(),
										modifiers: vec!["Primary".to_string()],
									}],
								},
							),
						]),
					},
				},
			},
		}
	}
}
