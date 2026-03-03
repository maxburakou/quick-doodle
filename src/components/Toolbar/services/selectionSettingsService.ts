import { Stroke, Tool } from "@/types";

interface ResolveSingleSelectedStrokeParams {
  activeTool: Tool;
  selectedStrokeIds: string[];
  primarySelectedStrokeId: string | null;
  present: Stroke[];
}

interface ApplyColorToStrokeParams {
  present: Stroke[];
  strokeId: string;
  color: string;
  isTransforming: boolean;
}

export const getSingleSelectedStroke = ({
  activeTool,
  selectedStrokeIds,
  primarySelectedStrokeId,
  present,
}: ResolveSingleSelectedStrokeParams): Stroke | null => {
  if (activeTool !== Tool.Select) return null;
  if (selectedStrokeIds.length !== 1) return null;

  const strokeId = primarySelectedStrokeId ?? selectedStrokeIds[0];
  return present.find((stroke) => stroke.id === strokeId) ?? null;
};

export const resolveContextColor = (
  storeColor: string,
  selectedStroke: Stroke | null
): string => {
  return selectedStroke?.color ?? storeColor;
};

export const applyColorToStroke = ({
  present,
  strokeId,
  color,
  isTransforming,
}: ApplyColorToStrokeParams): Stroke[] | null => {
  if (isTransforming) return null;

  const index = present.findIndex((stroke) => stroke.id === strokeId);
  if (index < 0) return null;

  const current = present[index];
  if (current.color === color) return null;

  const nextPresent = [...present];
  nextPresent[index] = { ...current, color };
  return nextPresent;
};
