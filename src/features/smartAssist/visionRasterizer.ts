import type { Stroke, StrokePoint } from "@/types";
import { getStrokesBBox, simplifyStroke } from "./utils";

export interface VisionRasterizeOptions {
  paddingPx: number;
  minSizePx: number;
  maxSizePx: number;
  scale: number;
  inkColor: string;
  backgroundColor: string;
  lineWidthPx: number;
  simplifyTolerancePx: number;
  minPointDistancePx: number;
  minInkHeightPx: number;
  minCanvasAspectRatio: number;
  maxScale: number;
  dotScaleMaxPoints: number;
  dotScaleMaxSizePx: number;
  includeDataUrl: boolean;
}

export interface VisionRasterizeResult {
  imageBytes: Uint8Array;
  imageDataUrl: string | null;
  width: number;
  height: number;
}

export const DEFAULT_VISION_RASTERIZE_OPTIONS: VisionRasterizeOptions = {
  paddingPx: 88,
  minSizePx: 96,
  maxSizePx: 1800,
  scale: 1.5,
  inkColor: "#000000",
  backgroundColor: "#ffffff",
  lineWidthPx: 5,
  simplifyTolerancePx: 1.15,
  minPointDistancePx: 1.25,
  minInkHeightPx: 96,
  minCanvasAspectRatio: 1.8,
  maxScale: 3.5,
  dotScaleMaxPoints: 2,
  dotScaleMaxSizePx: 10,
  includeDataUrl: import.meta.env.DEV,
};

type VisionCanvasContext =
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D;

const toPngBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });

const getCanvasScale = (
  inkHeight: number,
  paddedWidth: number,
  paddedHeight: number,
  options: VisionRasterizeOptions
) => {
  const maxCanvasScale =
    options.maxSizePx / Math.max(paddedWidth, paddedHeight, 1);
  const minInkScale = options.minInkHeightPx / Math.max(inkHeight, 1);

  return Math.min(
    Math.max(options.scale, minInkScale),
    options.maxScale,
    maxCanvasScale
  );
};

const isDotLikeStroke = (
  stroke: Stroke,
  options: VisionRasterizeOptions
) => {
  if (stroke.points.length > options.dotScaleMaxPoints) return false;

  const bbox = getStrokesBBox([stroke]);
  if (!bbox) return false;

  return (
    Math.max(bbox.maxX - bbox.minX, bbox.maxY - bbox.minY) <=
    Math.max(options.dotScaleMaxSizePx, stroke.thickness * 2)
  );
};

export const buildVisionRasterStrokes = (
  strokes: Stroke[],
  options: VisionRasterizeOptions = DEFAULT_VISION_RASTERIZE_OPTIONS
) => {
  const bbox = getStrokesBBox(strokes);
  if (!bbox) return null;

  const scaleSourceStrokes = strokes.filter(
    (stroke) => !isDotLikeStroke(stroke, options)
  );
  const scaleBBox = getStrokesBBox(scaleSourceStrokes) ?? bbox;
  const inkWidth = Math.max(1, bbox.maxX - bbox.minX);
  const inkHeight = Math.max(1, bbox.maxY - bbox.minY);
  const scaleInkHeight = Math.max(1, scaleBBox.maxY - scaleBBox.minY);
  const paddedWidth = inkWidth + options.paddingPx * 2;
  const paddedHeight = inkHeight + options.paddingPx * 2;
  const scale = getCanvasScale(
    scaleInkHeight,
    paddedWidth,
    paddedHeight,
    options
  );
  const contentWidth = Math.ceil(paddedWidth * scale);
  const contentHeight = Math.ceil(paddedHeight * scale);
  const height = Math.max(options.minSizePx, contentHeight);
  const width = Math.max(
    options.minSizePx,
    contentWidth,
    Math.ceil(height * options.minCanvasAspectRatio)
  );
  const extraX = Math.max(0, width - contentWidth) / 2;
  const extraY = Math.max(0, height - contentHeight) / 2;
  const padding = options.paddingPx * scale;

  return {
    width,
    height,
    strokes: strokes.map((stroke) => ({
      ...stroke,
      color: options.inkColor,
      thickness: Math.max(1, stroke.thickness * scale),
      points: stroke.points.map((point) => ({
        ...point,
        x: (point.x - bbox.minX) * scale + padding + extraX,
        y: (point.y - bbox.minY) * scale + padding + extraY,
      })),
    })),
  };
};

const getDistance = (left: StrokePoint, right: StrokePoint) =>
  Math.hypot(left.x - right.x, left.y - right.y);

const filterClosePoints = (
  points: StrokePoint[],
  minDistancePx: number
): StrokePoint[] => {
  if (points.length <= 2 || minDistancePx <= 0) return points;

  const filtered: StrokePoint[] = [points[0]];
  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index];
    const previous = filtered[filtered.length - 1];
    if (getDistance(previous, point) >= minDistancePx) {
      filtered.push(point);
    }
  }

  const last = points[points.length - 1];
  if (filtered[filtered.length - 1] !== last) {
    filtered.push(last);
  }

  return filtered;
};

const prepareVisionStrokePoints = (
  points: StrokePoint[],
  options: VisionRasterizeOptions
) => {
  const deDuplicated = filterClosePoints(points, options.minPointDistancePx);
  return simplifyStroke(
    deDuplicated,
    options.simplifyTolerancePx,
    true
  );
};

const drawVisionStrokePath = (
  ctx: VisionCanvasContext,
  points: StrokePoint[],
  color: string,
  lineWidth: number
) => {
  if (points.length === 0) return;

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (points.length === 1) {
    ctx.beginPath();
    ctx.arc(points[0].x, points[0].y, lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  if (points.length === 2) {
    ctx.lineTo(points[1].x, points[1].y);
    ctx.stroke();
    return;
  }

  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index];
    const next = points[index + 1];
    ctx.quadraticCurveTo(point.x, point.y, (point.x + next.x) / 2, (point.y + next.y) / 2);
  }

  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
};

export const drawVisionRasterStrokes = (
  strokes: Stroke[],
  ctx: VisionCanvasContext,
  options: VisionRasterizeOptions = DEFAULT_VISION_RASTERIZE_OPTIONS
) => {
  strokes.forEach((stroke) => {
    drawVisionStrokePath(
      ctx,
      prepareVisionStrokePoints(stroke.points, options),
      options.inkColor,
      options.lineWidthPx
    );
  });
};

export const renderStrokesForVisionOnMainThread = async (
  strokes: Stroke[],
  options: VisionRasterizeOptions = DEFAULT_VISION_RASTERIZE_OPTIONS
): Promise<VisionRasterizeResult | null> => {
  if (typeof document === "undefined") return null;

  const rasterStrokes = buildVisionRasterStrokes(strokes, options);
  if (!rasterStrokes) return null;

  const canvas = document.createElement("canvas");
  canvas.width = rasterStrokes.width;
  canvas.height = rasterStrokes.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = options.backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawVisionRasterStrokes(rasterStrokes.strokes, ctx, options);

  const blob = await toPngBlob(canvas);
  if (!blob) return null;

  return {
    imageBytes: new Uint8Array(await blob.arrayBuffer()),
    imageDataUrl: options.includeDataUrl ? canvas.toDataURL("image/png") : null,
    width: rasterStrokes.width,
    height: rasterStrokes.height,
  };
};
