use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub const SETTINGS_SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingsSnapshot {
	pub schema_version: u32,
	pub autostart: AutostartSettings,
	#[serde(default = "default_theme_settings")]
	pub theme: ThemeSettings,
	pub shortcuts: ShortcutsConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutostartSettings {
	pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeSettings {
	#[serde(default)]
	pub mode: ThemeMode,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum ThemeMode {
	Light,
	Dark,
	#[default]
	System,
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
	#[serde(default = "default_canvas_clipboard_scope")]
	pub clipboard: ShortcutScope,
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

fn default_canvas_clipboard_scope() -> ShortcutScope {
	ShortcutScope {
		actions: HashMap::from([
			(
				"copy".to_string(),
				ShortcutAction {
					bindings: vec![Binding {
						code: "KeyC".to_string(),
						modifiers: vec!["Primary".to_string()],
					}],
				},
			),
			(
				"cut".to_string(),
				ShortcutAction {
					bindings: vec![Binding {
						code: "KeyX".to_string(),
						modifiers: vec!["Primary".to_string()],
					}],
				},
			),
			(
				"paste".to_string(),
				ShortcutAction {
					bindings: vec![Binding {
						code: "KeyV".to_string(),
						modifiers: vec!["Primary".to_string()],
					}],
				},
			),
		]),
	}
}

fn default_theme_settings() -> ThemeSettings {
	ThemeSettings {
		mode: ThemeMode::System,
	}
}

impl SettingsSnapshot {
	pub fn defaults() -> Self {
		Self {
			schema_version: SETTINGS_SCHEMA_VERSION,
			autostart: AutostartSettings { enabled: false },
			theme: default_theme_settings(),
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
										modifiers: vec!["Primary".to_string(), "Shift".to_string()],
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
					clipboard: default_canvas_clipboard_scope(),
					tools: ShortcutScope {
						actions: (1..=9)
							.map(|i| {
								(
									format!("tool_{}", i),
									ShortcutAction {
										bindings: vec![
											Binding {
												code: format!("Digit{}", i),
												modifiers: vec![],
											},
											Binding {
												code: format!("Numpad{}", i),
												modifiers: vec![],
											},
										],
									},
								)
							})
							.collect(),
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
							(
								"toggle_theme_mode".to_string(),
								ShortcutAction {
									bindings: vec![Binding {
										code: "KeyM".to_string(),
										modifiers: vec!["Primary".to_string(), "Shift".to_string()],
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
