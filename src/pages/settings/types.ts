import { Binding, ValidationIssue } from "@/types/settings";

export type ShortcutScopeKey =
  | "global"
  | "canvas.history"
  | "canvas.toggles"
  | "canvas.tools";

export interface ShortcutActionDefinition {
  actionId: string;
  label: string;
}

export interface ShortcutSectionDefinition {
  id: string;
  title: string;
  scope: ShortcutScopeKey;
  actions: ShortcutActionDefinition[];
}

export interface ShortcutRowModel {
  key: string;
  scope: ShortcutScopeKey;
  actionId: string;
  label: string;
  path: string;
  binding: Binding | null;
  issue: ValidationIssue | null;
}

export interface ShortcutSectionModel {
  id: string;
  title: string;
  rows: ShortcutRowModel[];
}
