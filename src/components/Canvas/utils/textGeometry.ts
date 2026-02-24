import { Stroke, StrokePoint, Tool } from "@/types";
import { measureTextBox } from "./textLayout";

export const getStrokeBoundsFromPoints = (
  start: StrokePoint,
  end: StrokePoint
) => ({
  x: Math.min(start.x, end.x),
  y: Math.min(start.y, end.y),
  width: Math.abs(end.x - start.x),
  height: Math.abs(end.y - start.y),
});

export const normalizeTextStroke = (stroke: Stroke): Stroke => {
  if (stroke.tool !== Tool.Text || !stroke.text || stroke.points.length === 0) {
    return stroke;
  }

  const [normalizedStart, normalizedEnd] = normalizeTextPoints(
    stroke.points,
    stroke.text
  );
  const bounds = getStrokeBoundsFromPoints(normalizedStart, normalizedEnd);
  const fallbackMetrics = measureTextBox(stroke.text.value, stroke.text.fontSize);

  return {
    ...stroke,
    points: [normalizedStart, normalizedEnd],
    text: {
      ...stroke.text,
      width: Math.max(1, bounds.width || stroke.text.width || fallbackMetrics.width),
      height: Math.max(
        1,
        bounds.height || stroke.text.height || fallbackMetrics.height
      ),
    },
  };
};

export const normalizeTextPoints = (
  points: StrokePoint[],
  text: {
    value: string;
    fontSize: number;
    width?: number;
    height?: number;
  }
): [StrokePoint, StrokePoint] => {
  const start = points[0] ?? { x: 0, y: 0, pressure: 0.5 };
  const fallbackMetrics = measureTextBox(text.value, text.fontSize);
  const width = text.width ?? fallbackMetrics.width;
  const height = text.height ?? fallbackMetrics.height;

  const rawEnd = points[1] ?? {
    x: start.x + width,
    y: start.y + height,
    pressure: start.pressure,
  };

  const bounds = getStrokeBoundsFromPoints(start, rawEnd);

  const normalizedStart: StrokePoint = {
    x: bounds.x,
    y: bounds.y,
    pressure: start.pressure,
  };
  const normalizedEnd: StrokePoint = {
    x: bounds.x + bounds.width,
    y: bounds.y + bounds.height,
    pressure: rawEnd.pressure ?? start.pressure,
  };

  return [normalizedStart, normalizedEnd];
};

export const getTextBounds = (stroke: Stroke) => {
  const normalized = normalizeTextStroke(stroke);
  const start = normalized.points[0];
  const end = normalized.points[1] ?? start;

  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
};

export const hitTestText = (
  stroke: Stroke,
  pointer: Pick<StrokePoint, "x" | "y">,
  tolerance: number = 6
) => {
  const bounds = getTextBounds(stroke);
  const rotation = stroke.rotation ?? 0;
  const center = {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };

  const cos = Math.cos(-rotation);
  const sin = Math.sin(-rotation);
  const dx = pointer.x - center.x;
  const dy = pointer.y - center.y;
  const localX = center.x + dx * cos - dy * sin;
  const localY = center.y + dx * sin + dy * cos;

  return (
    localX >= bounds.x - tolerance &&
    localX <= bounds.x + bounds.width + tolerance &&
    localY >= bounds.y - tolerance &&
    localY <= bounds.y + bounds.height + tolerance
  );
};
