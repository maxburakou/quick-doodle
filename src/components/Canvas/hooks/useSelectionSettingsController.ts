import {
  useFontSize,
  useSetFontSize,
  useSetToolColor,
  useSetToolShapeFill,
  useSetToolThickness,
  useTool,
  useToolColor,
  useToolShapeFill,
  useToolThickness,
} from "@/store";
import { isFillableShapeTool, Tool } from "@/types";
import { useEffect, useMemo } from "react";
import {
  resolveGroupColorContext,
  resolveGroupFontSizeContext,
  resolveGroupThicknessContext,
} from "../helpers/selectionSettings";
import { useSelectedStrokes } from "./useSelectedStrokes";
import { useSingleSelectedStroke } from "./useSingleSelectedStroke";

export const useSelectionSettingsController = () => {
  const activeTool = useTool();
  const storeColor = useToolColor();
  const storeThickness = useToolThickness();
  const storeFontSize = useFontSize();
  const storeShapeFill = useToolShapeFill();

  const setToolColor = useSetToolColor();
  const setToolThickness = useSetToolThickness();
  const setFontSize = useSetFontSize();
  const setShapeFill = useSetToolShapeFill();

  const selectedStrokes = useSelectedStrokes();
  const selectedStroke = useSingleSelectedStroke();

  const groupColor = useMemo(
    () => resolveGroupColorContext(selectedStrokes),
    [selectedStrokes]
  );
  const groupThickness = useMemo(
    () => resolveGroupThicknessContext(selectedStrokes),
    [selectedStrokes]
  );
  const groupFontSize = useMemo(
    () => resolveGroupFontSizeContext(selectedStrokes),
    [selectedStrokes]
  );

  useEffect(() => {
    if (activeTool !== Tool.Select) return;

    if (selectedStroke) {
      if (storeColor !== selectedStroke.color) {
        setToolColor(selectedStroke.color);
      }

      if (selectedStroke.tool === Tool.Text && selectedStroke.text) {
        if (storeFontSize !== selectedStroke.text.fontSize) {
          setFontSize(selectedStroke.text.fontSize);
        }
        return;
      }

      if (
        isFillableShapeTool(selectedStroke.tool) &&
        storeShapeFill !== Boolean(selectedStroke.shapeFill)
      ) {
        setShapeFill(Boolean(selectedStroke.shapeFill));
      }

      if (storeThickness !== selectedStroke.thickness) {
        setToolThickness(selectedStroke.thickness);
      }
      return;
    }

    if (selectedStrokes.length > 1) {
      if (groupColor !== null && storeColor !== groupColor) {
        setToolColor(groupColor);
      }
      if (groupThickness !== null && storeThickness !== groupThickness) {
        setToolThickness(groupThickness);
      }
      if (groupFontSize !== null && storeFontSize !== groupFontSize) {
        setFontSize(groupFontSize);
      }
    }
  }, [
    activeTool,
    groupColor,
    groupFontSize,
    groupThickness,
    selectedStroke,
    selectedStrokes.length,
    setFontSize,
    setShapeFill,
    setToolColor,
    setToolThickness,
    storeColor,
    storeFontSize,
    storeShapeFill,
    storeThickness,
  ]);
};
