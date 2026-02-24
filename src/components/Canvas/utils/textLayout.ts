import { StrokePoint } from "@/types";

const FONT_FAMILY = "'JetBrains Mono', monospace";
const LINE_HEIGHT_RATIO = 1.1;
const ASCENT_RATIO = 0.8;
const MEASURE_SAMPLE = " ";

export interface FontMetrics {
  lineHeight: number;
  ascent: number;
  descent: number;
  baselineOffsetTop: number;
  baselineOffsetFromBoxTop: number;
}

export interface TextMetricsSize {
  width: number;
  height: number;
  lineHeight: number;
}

export interface TextLayout {
  lines: string[];
  lineCount: number;
  width: number;
  height: number;
  metrics: FontMetrics;
  getLineBaselineY: (boxTop: number, lineIndex: number) => number;
}

const getMeasureContext = () => {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  return canvas.getContext("2d");
};

const measureCtx = getMeasureContext();
const fontMetricsCache = new Map<string, FontMetrics>();

const toFontString = (fontSize: number) => `${fontSize}px ${FONT_FAMILY}`;
const toFontMetrics = (lineHeight: number, ascent: number, descent: number): FontMetrics => {
  const leading = Math.max(0, lineHeight - (ascent + descent));
  const baselineOffsetTop = ascent + leading / 2;

  return {
    lineHeight,
    ascent,
    descent,
    baselineOffsetTop,
    baselineOffsetFromBoxTop: baselineOffsetTop,
  };
};

const getFallbackMetrics = (fontSize: number) => {
  const lineHeight = fontSize * LINE_HEIGHT_RATIO;
  const ascent = fontSize * ASCENT_RATIO;
  const descent = Math.max(1, lineHeight - ascent);
  return toFontMetrics(lineHeight, ascent, descent);
};

const toTextLines = (value: string) => value.split("\n");

export const getFontMetrics = (fontSize: number): FontMetrics => {
  const fontString = toFontString(fontSize);
  const cached = fontMetricsCache.get(fontString);
  if (cached) return cached;

  const fallback = getFallbackMetrics(fontSize);
  if (!measureCtx) {
    fontMetricsCache.set(fontString, fallback);
    return fallback;
  }

  measureCtx.font = fontString;
  const metrics = measureCtx.measureText(MEASURE_SAMPLE);
  const rawAscent =
    metrics.fontBoundingBoxAscent ||
    metrics.actualBoundingBoxAscent ||
    fallback.ascent;
  const rawDescent =
    metrics.fontBoundingBoxDescent ||
    metrics.actualBoundingBoxDescent ||
    fallback.descent;

  const ascent = Math.max(1, rawAscent);
  const descent = Math.max(1, rawDescent);
  const lineHeight = Math.max(fallback.lineHeight, ascent + descent);
  const resolved = toFontMetrics(lineHeight, ascent, descent);

  fontMetricsCache.set(fontString, resolved);
  return resolved;
};

const measureLineWidth = (line: string, fontSize: number) => {
  if (!measureCtx) {
    return line.length * fontSize * 0.6;
  }
  measureCtx.font = toFontString(fontSize);
  return measureCtx.measureText(line || " ").width;
};

export const measureTextBox = (value: string, fontSize: number): TextMetricsSize => {
  const lines = toTextLines(value.length > 0 ? value : ".");
  const { lineHeight } = getFontMetrics(fontSize);

  let width = 0;
  lines.forEach((line) => {
    const nextWidth = measureLineWidth(line, fontSize);
    width = Math.max(width, nextWidth);
  });

  const height = Math.max(lineHeight, lines.length * lineHeight);

  return {
    width: Math.max(1, Math.ceil(width)),
    height: Math.max(1, Math.ceil(height)),
    lineHeight,
  };
};

export const getTextLayout = (fontSize: number, value: string): TextLayout => {
  const lines = toTextLines(value.length > 0 ? value : "");
  const normalizedLines = lines.length === 0 ? [""] : lines;
  const metrics = getFontMetrics(fontSize);
  const measured = measureTextBox(value, fontSize);

  return {
    lines: normalizedLines,
    lineCount: normalizedLines.length,
    width: measured.width,
    height: measured.height,
    metrics,
    getLineBaselineY: (boxTop: number, lineIndex: number) =>
      boxTop + metrics.baselineOffsetFromBoxTop + lineIndex * metrics.lineHeight,
  };
};

export const getBoxStartFromCaret = (
  caret: Pick<StrokePoint, "x" | "y">,
  fontSize: number
) => {
  const { lineHeight } = getFontMetrics(fontSize);
  return {
    x: caret.x,
    y: caret.y - lineHeight / 2,
  };
};

export const getCaretFromBoxStart = (
  boxStart: Pick<StrokePoint, "x" | "y">,
  fontSize: number
) => {
  const { lineHeight } = getFontMetrics(fontSize);
  return {
    x: boxStart.x,
    y: boxStart.y + lineHeight / 2,
  };
};
