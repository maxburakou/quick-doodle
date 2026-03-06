import {
  useHistoryStore,
  useShapeEditorStore,
  useTextSettingsStore,
  useTool,
  useToolSettingsStore,
} from "@/store";
import { isFillableShapeTool, Tool } from "@/types";
import { useCallback, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  applyShapeFillToStroke,
  applyGroupSelectionSettings,
  applySingleSelectionSettings,
} from "../helpers/selectionSettings";
import { useSelectedStrokes } from "./useSelectedStrokes";
import { useSingleSelectedStroke } from "./useSingleSelectedStroke";

export const useSelectionSettingsActions = () => {
  const activeTool = useTool();

  const selectedStrokes = useSelectedStrokes();
  const selectedStroke = useSingleSelectedStroke();
  const selectedStrokeIds = useMemo(
    () => selectedStrokes.map((stroke) => stroke.id),
    [selectedStrokes]
  );

  const { commitPresent } = useHistoryStore(
    useShallow((state) => ({ commitPresent: state.commitPresent }))
  );
  const { session } = useShapeEditorStore(
    useShallow((state) => ({ session: state.session }))
  );

  const applyToSelection = useCallback(
    (overrides: Partial<{ color: string; thickness: number; fontSize: number }>) => {
      if (activeTool !== Tool.Select || session) return;

      const hasSingleSelection = Boolean(selectedStroke);
      const hasGroupSelection = selectedStrokeIds.length > 1;
      if (!hasSingleSelection && !hasGroupSelection) return;

      const resolvedColor = overrides.color ?? useToolSettingsStore.getState().color;
      const resolvedThickness =
        overrides.thickness ?? useToolSettingsStore.getState().thickness;
      const resolvedFontSize =
        overrides.fontSize ?? useTextSettingsStore.getState().fontSize;
      const applyColor = overrides.color !== undefined;
      const applyThickness = overrides.thickness !== undefined;
      const applyFontSize = overrides.fontSize !== undefined;

      const currentPresent = useHistoryStore.getState().present;

      const nextPresent = selectedStroke
        ? applySingleSelectionSettings({
            present: currentPresent,
            selectedStroke,
            storeColor: resolvedColor,
            storeThickness: resolvedThickness,
            storeFontSize: resolvedFontSize,
            isTransforming: false,
            applyColor,
            applyThickness,
            applyFontSize,
          })
        : applyGroupSelectionSettings({
            present: currentPresent,
            selectedStrokeIds,
            storeColor: resolvedColor,
            storeThickness: resolvedThickness,
            storeFontSize: resolvedFontSize,
            isTransforming: false,
            applyColor,
            applyThickness,
            applyFontSize,
          });

      if (nextPresent) {
        commitPresent(nextPresent);
      }
    },
    [activeTool, commitPresent, selectedStroke, selectedStrokeIds, session]
  );

  const setColor = useCallback(
    (color: string) => {
      const prevColor = useToolSettingsStore.getState().color;
      if (color !== prevColor) {
        useToolSettingsStore.getState().setColor(color);
      }
      applyToSelection({ color });
    },
    [applyToSelection]
  );

  const updateColor = useCallback(
    (color: string) => {
      const prevColor = useToolSettingsStore.getState().color;
      useToolSettingsStore.getState().updateColor(color);
      const nextColor = useToolSettingsStore.getState().color;
      if (nextColor === prevColor) return;
      applyToSelection({ color: nextColor });
    },
    [applyToSelection]
  );

  const setThickness = useCallback(
    (thickness: number) => {
      const prevThickness = useToolSettingsStore.getState().thickness;
      if (thickness !== prevThickness) {
        useToolSettingsStore.getState().setThickness(thickness);
      }
      applyToSelection({ thickness });
    },
    [applyToSelection]
  );

  const setFontSize = useCallback(
    (fontSize: number) => {
      const prevFontSize = useTextSettingsStore.getState().fontSize;
      if (fontSize !== prevFontSize) {
        useTextSettingsStore.getState().setFontSize(fontSize);
      }
      applyToSelection({ fontSize });
    },
    [applyToSelection]
  );

  const setShapeFill = useCallback(
    (enabled: boolean) => {
      const prevEnabled = useToolSettingsStore.getState().shapeFill;
      if (enabled !== prevEnabled) {
        useToolSettingsStore.getState().setShapeFill(enabled);
      }

      if (
        activeTool !== Tool.Select ||
        session ||
        !selectedStroke ||
        !isFillableShapeTool(selectedStroke.tool)
      ) {
        return;
      }

      const currentPresent = useHistoryStore.getState().present;
      const nextPresent = applyShapeFillToStroke({
        present: currentPresent,
        strokeId: selectedStroke.id,
        enabled,
        isTransforming: false,
      });

      if (nextPresent) {
        commitPresent(nextPresent);
      }
    },
    [activeTool, commitPresent, selectedStroke, session]
  );

  return {
    setColor,
    updateColor,
    setThickness,
    setFontSize,
    setShapeFill,
  };
};
