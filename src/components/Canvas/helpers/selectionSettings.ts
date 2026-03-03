import { Stroke, Tool } from "@/types";
import { normalizeTextStroke } from "@/components/Canvas/utils/textGeometry";
import { measureTextBox } from "@/components/Canvas/utils/textLayout";

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

interface ApplyThicknessToStrokeParams {
  present: Stroke[];
  strokeId: string;
  thickness: number;
  isTransforming: boolean;
}

interface ApplyFontSizeToStrokeParams {
  present: Stroke[];
  strokeId: string;
  fontSize: number;
  isTransforming: boolean;
}

interface ApplySingleSelectionSettingsParams {
  present: Stroke[];
  selectedStroke: Stroke;
  storeColor: string;
  storeThickness: number;
  storeFontSize: number;
  isTransforming: boolean;
}

interface UpdateStrokeByIdParams {
  present: Stroke[];
  strokeId: string;
  isTransforming: boolean;
  shouldUpdate: (stroke: Stroke) => boolean;
  getNextStroke: (stroke: Stroke) => Stroke;
}

const findStrokeIndex = (present: Stroke[], strokeId: string): number => {
  return present.findIndex((stroke) => stroke.id === strokeId);
};

const replaceStrokeAt = (
  present: Stroke[],
  index: number,
  nextStroke: Stroke
): Stroke[] => {
  const nextPresent = [...present];
  nextPresent[index] = nextStroke;
  return nextPresent;
};

const updateStrokeById = ({
  present,
  strokeId,
  isTransforming,
  shouldUpdate,
  getNextStroke,
}: UpdateStrokeByIdParams): Stroke[] | null => {
  if (isTransforming) return null;

  const index = findStrokeIndex(present, strokeId);
  if (index < 0) return null;

  const current = present[index];
  if (!shouldUpdate(current)) return null;

  return replaceStrokeAt(present, index, getNextStroke(current));
};

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

export const resolveContextThickness = (
  storeThickness: number,
  selectedStroke: Stroke | null
): number => {
  if (!selectedStroke || selectedStroke.tool === Tool.Text) return storeThickness;
  return selectedStroke.thickness;
};

export const resolveContextFontSize = (
  storeFontSize: number,
  selectedStroke: Stroke | null
): number => {
  if (!selectedStroke || selectedStroke.tool !== Tool.Text || !selectedStroke.text) {
    return storeFontSize;
  }
  return selectedStroke.text.fontSize;
};

export const applyColorToStroke = ({
  present,
  strokeId,
  color,
  isTransforming,
}: ApplyColorToStrokeParams): Stroke[] | null => {
  return updateStrokeById({
    present,
    strokeId,
    isTransforming,
    shouldUpdate: (stroke) => stroke.color !== color,
    getNextStroke: (stroke) => ({ ...stroke, color }),
  });
};

export const applyThicknessToStroke = ({
  present,
  strokeId,
  thickness,
  isTransforming,
}: ApplyThicknessToStrokeParams): Stroke[] | null => {
  return updateStrokeById({
    present,
    strokeId,
    isTransforming,
    shouldUpdate: (stroke) =>
      stroke.tool !== Tool.Text && stroke.thickness !== thickness,
    getNextStroke: (stroke) => ({ ...stroke, thickness }),
  });
};

export const applyFontSizeToStroke = ({
  present,
  strokeId,
  fontSize,
  isTransforming,
}: ApplyFontSizeToStrokeParams): Stroke[] | null => {
  if (isTransforming) return null;

  const index = findStrokeIndex(present, strokeId);
  if (index < 0) return null;

  const current = present[index];
  if (current.tool !== Tool.Text || !current.text) return null;

  const normalized = normalizeTextStroke(current);
  const text = normalized.text;
  if (!text) return null;

  if (text.fontSize === fontSize && normalized.thickness === fontSize) return null;

  const start = normalized.points[0] ?? { x: 0, y: 0, pressure: 0.5 };
  const metrics = measureTextBox(text.value, fontSize);
  const nextStroke: Stroke = {
    ...normalized,
    // TODO(decouple-text-thickness): keep legacy link for now; text should own font size independently.
    thickness: fontSize,
    text: {
      ...text,
      fontSize,
      width: metrics.width,
      height: metrics.height,
    },
    points: [
      start,
      {
        x: start.x + metrics.width,
        y: start.y + metrics.height,
        pressure: normalized.points[1]?.pressure ?? start.pressure,
      },
    ],
  };

  return replaceStrokeAt(present, index, nextStroke);
};

export const applySingleSelectionSettings = ({
  present,
  selectedStroke,
  storeColor,
  storeThickness,
  storeFontSize,
  isTransforming,
}: ApplySingleSelectionSettingsParams): Stroke[] | null => {
  let nextPresent: Stroke[] | null = null;
  let workingPresent = present;

  // Apply color first, then shape/text-specific property.
  const colorResult = applyColorToStroke({
    present: workingPresent,
    strokeId: selectedStroke.id,
    color: storeColor,
    isTransforming,
  });

  if (colorResult) {
    nextPresent = colorResult;
    workingPresent = colorResult;
  }

  if (selectedStroke.tool === Tool.Text && selectedStroke.text) {
    const fontSizeResult = applyFontSizeToStroke({
      present: workingPresent,
      strokeId: selectedStroke.id,
      fontSize: storeFontSize,
      isTransforming,
    });

    if (fontSizeResult) {
      nextPresent = fontSizeResult;
    }

    return nextPresent;
  }

  const thicknessResult = applyThicknessToStroke({
    present: workingPresent,
    strokeId: selectedStroke.id,
    thickness: storeThickness,
    isTransforming,
  });

  if (thicknessResult) {
    nextPresent = thicknessResult;
  }

  return nextPresent;
};
