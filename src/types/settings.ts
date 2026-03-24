// TODO: replace manual settings types with Rust-generated bindings - implement codegen.

export interface Binding {
  code: string;
  modifiers: string[];
}

export interface ShortcutAction {
  bindings: Binding[];
}

export interface ShortcutScope {
  actions: Record<string, ShortcutAction>;
}

export interface SettingsSnapshot {
  schema_version: number;
  autostart: {
    enabled: boolean;
  };
  theme: {
    mode: "light" | "dark" | "system";
  };
  tray: {
    inactive_click_action: "open_previous_canvas" | "open_new_canvas";
  };
  shortcuts: {
    policy: {
      conflicts: {
        mode: string;
      };
      global: {
        require_primary: boolean;
        allow_single_modifier: boolean;
      };
      canvas: {
        allow_single_key: boolean;
      };
    };
    global: ShortcutScope;
    canvas: {
      history: ShortcutScope;
      clipboard: ShortcutScope;
      tools: ShortcutScope;
      toggles: ShortcutScope;
    };
  };
}

export interface ValidationIssue {
  path: string;
  kind: string;
  message: string;
}
