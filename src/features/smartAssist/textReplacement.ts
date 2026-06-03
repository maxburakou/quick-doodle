import { DEFAULT_FONT_SIZE } from "@/config";
import { measureTextBox } from "@/components/Canvas/utils";
import { createStrokeId } from "@/store/useShapeEditorStore/helpers";
import { Stroke, TextElement, Tool } from "@/types";
import { getStrokesBBox } from "./utils";

const pickNearestFontSize = (targetSize: number) =>
  DEFAULT_FONT_SIZE.reduce((best, current) =>
    Math.abs(current - targetSize) < Math.abs(best - targetSize) ? current : best
  );

export const buildTextReplacementStroke = (
  sourceStrokes: Stroke[],
  value: string
): Stroke | null => {
  const bbox = getStrokesBBox(sourceStrokes);
  const baseStroke = sourceStrokes[0];
  if (!bbox || !baseStroke) return null;

  const bboxHeight = Math.max(1, bbox.maxY - bbox.minY);
  const fontSize = pickNearestFontSize(bboxHeight * 0.9);
  const metrics = measureTextBox(value, fontSize);
  const text: TextElement = {
    value,
    fontSize,
    width: metrics.width,
    height: metrics.height,
  };

  return {
    id: createStrokeId(),
    points: [
      {
        x: bbox.minX,
        y: bbox.minY,
        pressure: baseStroke.points[0]?.pressure ?? 0.5,
        t: baseStroke.points[0]?.t,
      },
      {
        x: bbox.minX + metrics.width,
        y: bbox.minY + metrics.height,
        pressure: baseStroke.points[baseStroke.points.length - 1]?.pressure ?? 0.5,
        t: baseStroke.points[baseStroke.points.length - 1]?.t,
      },
    ],
    color: baseStroke.color,
    thickness: fontSize,
    tool: Tool.Text,
    text,
    rotation: 0,
  };
};
