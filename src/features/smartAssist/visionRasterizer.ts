import { drawStrokes } from "@/components/Canvas/utils";
import type { Stroke } from "@/types";
import { getStrokesBBox } from "./utils";

export interface VisionRasterizeOptions {
  paddingPx: number;
  minSizePx: number;
  maxSizePx: number;
  scale: number;
  inkColor: string;
  backgroundColor: string;
  includeDataUrl: boolean;
}

export interface VisionRasterizeResult {
  imageBytes: Uint8Array;
  imageDataUrl: string | null;
  width: number;
  height: number;
}

export const DEFAULT_VISION_RASTERIZE_OPTIONS: VisionRasterizeOptions = {
  paddingPx: 48,
  minSizePx: 96,
  maxSizePx: 1800,
  scale: 2,
  inkColor: "#0b0f14",
  backgroundColor: "#ffffff",
  includeDataUrl: import.meta.env.DEV,
};

const toPngBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });

const getCanvasScale = (
  width: number,
  height: number,
  options: VisionRasterizeOptions
) => Math.min(options.scale, options.maxSizePx / Math.max(width, height, 1));

export const buildVisionRasterStrokes = (
  strokes: Stroke[],
  options: VisionRasterizeOptions = DEFAULT_VISION_RASTERIZE_OPTIONS
) => {
  const bbox = getStrokesBBox(strokes);
  if (!bbox) return null;

  const paddedWidth = bbox.maxX - bbox.minX + options.paddingPx * 2;
  const paddedHeight = bbox.maxY - bbox.minY + options.paddingPx * 2;
  const scale = getCanvasScale(paddedWidth, paddedHeight, options);
  const width = Math.max(options.minSizePx, Math.ceil(paddedWidth * scale));
  const height = Math.max(options.minSizePx, Math.ceil(paddedHeight * scale));
  const offsetX = bbox.minX - options.paddingPx;
  const offsetY = bbox.minY - options.paddingPx;

  return {
    width,
    height,
    strokes: strokes.map((stroke) => ({
      ...stroke,
      color: options.inkColor,
      thickness: Math.max(1, stroke.thickness * scale),
      points: stroke.points.map((point) => ({
        ...point,
        x: (point.x - offsetX) * scale,
        y: (point.y - offsetY) * scale,
      })),
    })),
  };
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
  drawStrokes(rasterStrokes.strokes, ctx);

  const blob = await toPngBlob(canvas);
  if (!blob) return null;

  return {
    imageBytes: new Uint8Array(await blob.arrayBuffer()),
    imageDataUrl: options.includeDataUrl ? canvas.toDataURL("image/png") : null,
    width: rasterStrokes.width,
    height: rasterStrokes.height,
  };
};
