import { SettingsSnapshot, Binding } from "@/types/settings";

const IS_MAC_OS = navigator.platform.toLowerCase().includes("mac");
let canvasComboActionMap: Record<string, string> = {};

const normalizeModifier = (modifier: string) => {
  switch (modifier) {
    case "Primary":
      return IS_MAC_OS ? "Meta" : "Control";
    case "Shift":
      return "Shift";
    case "Alt":
      return "Alt";
    case "Meta":
      return "Meta";
    case "Control":
      return "Control";
    default:
      return modifier;
  }
};

const comboKeyFromBinding = (binding: Binding) => {
  const modifiers = [...binding.modifiers.map(normalizeModifier)].sort();
  return `${binding.code}::${modifiers.join("+")}`;
};

const comboKeyFromEvent = (event: KeyboardEvent) => {
  const modifiers = [...eventModifierSet(event)].sort();
  return `${event.code}::${modifiers.join("+")}`;
};

const eventModifierSet = (event: KeyboardEvent) => {
  const active = new Set<string>();
  if (event.shiftKey) active.add("Shift");
  if (event.altKey) active.add("Alt");
  if (event.metaKey) active.add("Meta");
  if (event.ctrlKey) active.add("Control");
  return active;
};

const appendGroupBindings = (
  output: Record<string, string>,
  scopePrefix: string,
  actions: Record<string, { bindings: Binding[] }>
) => {
  Object.entries(actions).forEach(([action, value]) => {
    const actionId = `${scopePrefix}.${action}`;
    value.bindings.forEach((binding) => {
      output[comboKeyFromBinding(binding)] = actionId;
    });
  });
};

export const updateCanvasShortcutMatcher = (snapshot: SettingsSnapshot) => {
  canvasComboActionMap = {};

  appendGroupBindings(
    canvasComboActionMap,
    "canvas.history",
    snapshot.shortcuts.canvas.history.actions
  );
  appendGroupBindings(
    canvasComboActionMap,
    "canvas.clipboard",
    snapshot.shortcuts.canvas.clipboard.actions
  );
  appendGroupBindings(
    canvasComboActionMap,
    "canvas.tools",
    snapshot.shortcuts.canvas.tools.actions
  );
  appendGroupBindings(
    canvasComboActionMap,
    "canvas.toggles",
    snapshot.shortcuts.canvas.toggles.actions
  );
};

export const resolveCanvasShortcutAction = (event: KeyboardEvent): string | null => {
  const actionId = canvasComboActionMap[comboKeyFromEvent(event)];
  return actionId ?? null;
};

export const resolveToolHotkeyLabel = (
  snapshot: SettingsSnapshot | null,
  slot: number
): string => {
  if (!snapshot) return String(slot);

  const action = snapshot.shortcuts.canvas.tools.actions[`tool_${slot}`];
  const binding = action?.bindings?.[0];

  if (!binding) return String(slot);

  if (binding.code.startsWith("Digit")) {
    return binding.code.replace("Digit", "");
  }

  if (binding.code.startsWith("Numpad")) {
    return binding.code.replace("Numpad", "");
  }

  if (binding.code.startsWith("Key")) {
    return binding.code.replace("Key", "");
  }

  return binding.code;
};
