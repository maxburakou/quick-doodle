import { Binding, SettingsSnapshot, ShortcutAction, ValidationIssue } from "@/types/settings";
import { SHORTCUT_SECTIONS } from "../constants/shortcutActions";
import { ShortcutScopeKey, ShortcutSectionModel } from "../types";

const DISPLAY_MODIFIERS: Array<"Primary" | "Shift" | "Alt"> = ["Primary", "Shift", "Alt"];
const PRIMARY_CODES = new Set(["MetaLeft", "MetaRight", "ControlLeft", "ControlRight"]);
const MODIFIER_ONLY_CODES = new Set([
  "MetaLeft",
  "MetaRight",
  "ControlLeft",
  "ControlRight",
  "ShiftLeft",
  "ShiftRight",
  "AltLeft",
  "AltRight",
]);

export const getPrimaryBinding = (action?: ShortcutAction | null): Binding | null => {
  if (!action || action.bindings.length === 0) {
    return null;
  }

  return action.bindings[0] ?? null;
};

const keyCodeToLabel = (code: string) => {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return code.slice(6);
  return code;
};

export const formatBinding = (binding: Binding | null, isMac: boolean) => {
  if (!binding) return "Not set";

  const modifierLabels = binding.modifiers
    .filter((modifier): modifier is "Primary" | "Shift" | "Alt" =>
      DISPLAY_MODIFIERS.includes(modifier as "Primary" | "Shift" | "Alt")
    )
    .map((modifier) => {
      if (!isMac) {
        if (modifier === "Primary") return "Ctrl";
        if (modifier === "Shift") return "Shift";
        return "Alt";
      }

      if (modifier === "Primary") return "⌘";
      if (modifier === "Shift") return "⇧";
      return "⌥";
    });

  const keyLabel = keyCodeToLabel(binding.code);
  if (modifierLabels.length === 0) return keyLabel;

  if (isMac) {
    return `${modifierLabels.join("")}${keyLabel}`;
  }

  return `${modifierLabels.join("+")}+${keyLabel}`;
};

const normalizeEventModifiers = (event: KeyboardEvent): string[] => {
  const modifiers: string[] = [];

  if (event.metaKey || event.ctrlKey || PRIMARY_CODES.has(event.code)) {
    modifiers.push("Primary");
  }
  if (event.shiftKey || event.code.startsWith("Shift")) {
    modifiers.push("Shift");
  }
  if (event.altKey || event.code.startsWith("Alt")) {
    modifiers.push("Alt");
  }

  return DISPLAY_MODIFIERS.filter((modifier) => modifiers.includes(modifier));
};

export const keyboardEventToBinding = (event: KeyboardEvent): Binding => {
  return {
    code: event.code,
    modifiers: normalizeEventModifiers(event),
  };
};

export const getScopeActions = (draft: SettingsSnapshot, scope: ShortcutScopeKey) => {
  if (scope === "global") {
    return draft.shortcuts.global.actions;
  }

  if (scope === "canvas.history") {
    return draft.shortcuts.canvas.history.actions;
  }

  if (scope === "canvas.toggles") {
    return draft.shortcuts.canvas.toggles.actions;
  }

  return draft.shortcuts.canvas.tools.actions;
};

export const mapShortcutSections = (
  draft: SettingsSnapshot,
  validationIssues: ValidationIssue[]
): ShortcutSectionModel[] => {
  return SHORTCUT_SECTIONS.map((section) => {
    const actions = getScopeActions(draft, section.scope);
    const rows = section.actions.map((action) => {
      const path = buildIssuePath(section.scope, action.actionId);

      return {
        key: buildRowKey(section.scope, action.actionId),
        scope: section.scope,
        actionId: action.actionId,
        label: action.label,
        path,
        binding: getPrimaryBinding(actions[action.actionId]),
        issue: resolveIssueForPath(validationIssues, path),
      };
    });

    return {
      id: section.id,
      title: section.title,
      rows,
    };
  });
};

export const updateActionPrimaryBinding = (
  draft: SettingsSnapshot,
  scope: ShortcutScopeKey,
  actionId: string,
  bindingOrNull: Binding | null
): SettingsSnapshot => {
  const actions = getScopeActions(draft, scope);
  const currentAction = actions[actionId] ?? { bindings: [] };

  actions[actionId] = {
    ...currentAction,
    bindings: bindingOrNull ? [bindingOrNull] : [],
  };

  return draft;
};

export const buildIssuePath = (scope: ShortcutScopeKey, actionId: string) => {
  return `shortcuts.${scope}.actions.${actionId}.bindings`;
};

export const resolveIssueForPath = (
  issues: ValidationIssue[],
  path: string
): ValidationIssue | null => {
  return issues.find((issue) => issue.path === path || issue.path.startsWith(`${path}[`)) ?? null;
};

export const getIssueMessage = (issue: ValidationIssue | null): string => {
  if (!issue) return "";
  if (issue.kind === "conflict") return "Duplicate shortcut. Choose a unique key combination.";
  return issue.message;
};

export const buildRowKey = (scope: ShortcutScopeKey, actionId: string) => {
  return `${scope}::${actionId}`;
};

export const parseRowKey = (
  rowKey: string | null
): { scope: ShortcutScopeKey; actionId: string } | null => {
  if (!rowKey) return null;

  const parts = rowKey.split("::");
  if (parts.length !== 2) return null;

  const scope = parts[0] as ShortcutScopeKey;
  const actionId = parts[1];

  if (!actionId) return null;

  if (
    scope !== "global" &&
    scope !== "canvas.history" &&
    scope !== "canvas.toggles" &&
    scope !== "canvas.tools"
  ) {
    return null;
  }

  return { scope, actionId };
};

export const isModifierOnlyKey = (code: string) => MODIFIER_ONLY_CODES.has(code);
