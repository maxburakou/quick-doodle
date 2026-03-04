import { usePresent, useShapeEditorStore, useTool } from "@/store";
import { Stroke, Tool } from "@/types";
import { useShallow } from "zustand/react/shallow";
import { SETTING_REGISTRY, TOOL_CONFIG } from "../config";
import {
  TOOLBAR_SETTING_CONTROL,
  TOOLBAR_SETTINGS_CONTEXT,
  ToolbarResolvedContext,
} from "../types";

const resolveSettingsContext = ({
  activeTool,
  selectedStrokeIds,
  primarySelectedStrokeId,
  present,
}: {
  activeTool: Tool;
  selectedStrokeIds: string[];
  primarySelectedStrokeId: string | null;
  present: Stroke[];
}): ToolbarResolvedContext => {
  if (activeTool !== Tool.Select) {
    return { context: TOOLBAR_SETTINGS_CONTEXT.ACTIVE_TOOL, tool: activeTool };
  }

  if (selectedStrokeIds.length > 1) {
    return { context: TOOLBAR_SETTINGS_CONTEXT.GROUP_SELECTION, tool: Tool.Select };
  }

  if (selectedStrokeIds.length === 1) {
    const targetId = primarySelectedStrokeId ?? selectedStrokeIds[0];
    const selectedStroke = present.find((stroke) => stroke.id === targetId);
    return {
      context: TOOLBAR_SETTINGS_CONTEXT.SINGLE_SELECTION,
      tool: selectedStroke?.tool ?? null,
    };
  }

  return { context: TOOLBAR_SETTINGS_CONTEXT.NONE, tool: null };
};

export const useToolbarSettingsContext = () => {
  const activeTool = useTool();
  const present = usePresent();
  const { selectedStrokeIds, primarySelectedStrokeId } = useShapeEditorStore(
    useShallow((state) => ({
      selectedStrokeIds: state.selectedStrokeIds,
      primarySelectedStrokeId: state.primarySelectedStrokeId,
    })),
  );

  const resolvedContext = resolveSettingsContext({
    activeTool,
    selectedStrokeIds,
    primarySelectedStrokeId,
    present,
  });
  const effectiveTool =
    resolvedContext.context === TOOLBAR_SETTINGS_CONTEXT.GROUP_SELECTION
      ? null
      : resolvedContext.tool;

  const visibleSettings =
    resolvedContext.context === TOOLBAR_SETTINGS_CONTEXT.GROUP_SELECTION
      ? (() => {
          const selectedIdSet = new Set(selectedStrokeIds);
          const selectedStrokes = present.filter((stroke) => selectedIdSet.has(stroke.id));
          const settingIds = new Set<string>();

          selectedStrokes.forEach((stroke) => {
            const toolSettings = TOOL_CONFIG[stroke.tool]?.settings ?? [];
            toolSettings.forEach((settingId) => settingIds.add(settingId));
          });

          const orderedSettings = [
            TOOLBAR_SETTING_CONTROL.COLOR,
            TOOLBAR_SETTING_CONTROL.STROKE,
            TOOLBAR_SETTING_CONTROL.TEXT_SIZE,
          ].filter((settingId) => settingIds.has(settingId));

          return orderedSettings
            .map((settingId) => SETTING_REGISTRY[settingId])
            .filter(
              (
                definition,
              ): definition is (typeof SETTING_REGISTRY)[keyof typeof SETTING_REGISTRY] =>
                Boolean(definition)
            );
        })()
      : !effectiveTool
        ? []
        : (TOOL_CONFIG[effectiveTool]?.settings ?? [])
            .map((settingId) => SETTING_REGISTRY[settingId])
            .filter(
              (
                definition,
              ): definition is (typeof SETTING_REGISTRY)[keyof typeof SETTING_REGISTRY] =>
                Boolean(definition) &&
                (definition.isVisible?.({
                  tool: effectiveTool,
                  context: resolvedContext.context,
                }) ??
                  true),
            );

  return {
    resolvedContext,
    effectiveTool,
    visibleSettings,
    shouldShowSettings: visibleSettings.length > 0,
  };
};
