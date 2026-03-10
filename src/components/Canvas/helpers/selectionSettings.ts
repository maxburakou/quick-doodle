import { isFillableShapeTool, Stroke, Tool } from "@/types";
import { normalizeTextStroke } from "@/components/Canvas/utils/textGeometry";
import { measureTextBox } from "@/components/Canvas/utils/textLayout";

interface ResolveSingleSelectedStrokeParams {
  activeTool: Tool;
  selectedStrokeIds: string[];
  primarySelectedStrokeId: string | null;
  present: Stroke[];
}

interface ResolveSelectedStrokesParams {
  activeTool: Tool;
  selectedStrokeIds: string[];
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

interface ApplyShapeFillToStrokeParams {
  present: Stroke[];
  strokeId: string;
  enabled: boolean;
  isTransforming: boolean;
}

interface ApplySingleSelectionSettingsParams {
  present: Stroke[];
  selectedStroke: Stroke;
  storeColor: string;
  storeThickness: number;
  storeFontSize: number;
  isTransforming: boolean;
  applyColor?: boolean;
  applyThickness?: boolean;
  applyFontSize?: boolean;
}

interface ApplyGroupSelectionSettingsParams {
  present: Stroke[];
  selectedStrokeIds: string[];
  storeColor: string;
  storeThickness: number;
  storeFontSize: number;
  isTransforming: boolean;
  applyColor?: boolean;
  applyThickness?: boolean;
  applyFontSize?: boolean;
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

const supportsColor = (tool: Tool): boolean => tool !== Tool.Select;
const supportsThickness = (tool: Tool): boolean =>
  tool !== Tool.Text && tool !== Tool.Select;
const supportsFontSize = (tool: Tool): boolean => tool === Tool.Text;
const supportsShapeFill = (tool: Tool): boolean => isFillableShapeTool(tool);

const buildShapeFill = (color: string) => ({
  color,
  style: "solid" as const,
});

const applyFontSizeToTextStroke = (current: Stroke, fontSize: number): Stroke | null => {
  if (current.tool !== Tool.Text || !current.text) return null;

  const normalized = normalizeTextStroke(current);
  const text = normalized.text;
  if (!text) return null;

  if (text.fontSize === fontSize && normalized.thickness === fontSize) return null;

  const start = normalized.points[0] ?? { x: 0, y: 0, pressure: 0.5 };
  const metrics = measureTextBox(text.value, fontSize);

  return {
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
};

const resolveUniformValue = <T>(
  strokes: Stroke[],
  isRelevant: (stroke: Stroke) => boolean,
  getValue: (stroke: Stroke) => T
): T | null => {
  const relevant = strokes.filter(isRelevant);
  if (relevant.length === 0) return null;

  const firstValue = getValue(relevant[0]);
  const isUniform = relevant.every((stroke) => getValue(stroke) === firstValue);
  return isUniform ? firstValue : null;
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

export const getSelectedStrokes = ({
  activeTool,
  selectedStrokeIds,
  present,
}: ResolveSelectedStrokesParams): Stroke[] => {
  if (activeTool !== Tool.Select || selectedStrokeIds.length === 0) return [];

  const selectedIdSet = new Set(selectedStrokeIds);
  return present.filter((stroke) => selectedIdSet.has(stroke.id));
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

export const resolveGroupColorContext = (selectedStrokes: Stroke[]): string | null => {
  return resolveUniformValue(
    selectedStrokes,
    (stroke) => supportsColor(stroke.tool),
    (stroke) => stroke.color
  );
};

export const resolveGroupThicknessContext = (
  selectedStrokes: Stroke[]
): number | null => {
  return resolveUniformValue(
    selectedStrokes,
    (stroke) => supportsThickness(stroke.tool),
    (stroke) => stroke.thickness
  );
};

export const resolveGroupFontSizeContext = (
  selectedStrokes: Stroke[]
): number | null => {
  return resolveUniformValue(
    selectedStrokes,
    (stroke) => supportsFontSize(stroke.tool) && Boolean(stroke.text),
    (stroke) => stroke.text?.fontSize ?? 0
  );
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
  const nextStroke = applyFontSizeToTextStroke(current, fontSize);
  if (!nextStroke) return null;

  return replaceStrokeAt(present, index, nextStroke);
};

export const applyShapeFillToStroke = ({
  present,
  strokeId,
  enabled,
  isTransforming,
}: ApplyShapeFillToStrokeParams): Stroke[] | null => {
  return updateStrokeById({
    present,
    strokeId,
    isTransforming,
    shouldUpdate: (stroke) =>
      supportsShapeFill(stroke.tool) && Boolean(stroke.shapeFill) !== enabled,
    getNextStroke: (stroke) => ({
      ...stroke,
      shapeFill: enabled ? buildShapeFill(stroke.color) : undefined,
    }),
  });
};

export const applyGroupSelectionSettings = ({
  present,
  selectedStrokeIds,
  storeColor,
  storeThickness,
  storeFontSize,
  isTransforming,
  applyColor = true,
  applyThickness = true,
  applyFontSize = true,
}: ApplyGroupSelectionSettingsParams): Stroke[] | null => {
  if (isTransforming || selectedStrokeIds.length === 0) return null;

  const selectedIdSet = new Set(selectedStrokeIds);
  let hasChanges = false;

  const nextPresent = present.map((stroke) => {
    if (!selectedIdSet.has(stroke.id)) return stroke;

    let nextStroke = stroke;

    if (
      applyColor &&
      supportsColor(nextStroke.tool) &&
      nextStroke.color !== storeColor
    ) {
      nextStroke = { ...nextStroke, color: storeColor };
      hasChanges = true;
    }

    if (
      applyThickness &&
      supportsThickness(nextStroke.tool) &&
      nextStroke.thickness !== storeThickness
    ) {
      nextStroke = { ...nextStroke, thickness: storeThickness };
      hasChanges = true;
    }

    if (applyFontSize && supportsFontSize(nextStroke.tool)) {
      const withFontSize = applyFontSizeToTextStroke(nextStroke, storeFontSize);
      if (withFontSize) {
        nextStroke = withFontSize;
        hasChanges = true;
      }
    }

    return nextStroke;
  });

  return hasChanges ? nextPresent : null;
};

export const applySingleSelectionSettings = ({
  present,
  selectedStroke,
  storeColor,
  storeThickness,
  storeFontSize,
  isTransforming,
  applyColor = true,
  applyThickness = true,
  applyFontSize = true,
}: ApplySingleSelectionSettingsParams): Stroke[] | null => {
  let nextPresent: Stroke[] | null = null;
  let workingPresent = present;

  if (applyColor) {
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
  }

  if (selectedStroke.tool === Tool.Text && selectedStroke.text) {
    if (applyFontSize) {
      const fontSizeResult = applyFontSizeToStroke({
        present: workingPresent,
        strokeId: selectedStroke.id,
        fontSize: storeFontSize,
        isTransforming,
      });

      if (fontSizeResult) {
        nextPresent = fontSizeResult;
      }
    }

    return nextPresent;
  }

  if (applyThickness) {
    const thicknessResult = applyThicknessToStroke({
      present: workingPresent,
      strokeId: selectedStroke.id,
      thickness: storeThickness,
      isTransforming,
    });

    if (thicknessResult) {
      nextPresent = thicknessResult;
    }
  }

  return nextPresent;
};
