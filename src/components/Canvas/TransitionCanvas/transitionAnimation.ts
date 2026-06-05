import {
  SmartAssistBatch,
  SmartAssistTransition,
} from "@/features/smartAssist/types";
import { ShapeBounds, Stroke } from "@/types";
import { drawStrokes } from "../utils";
import { getVisualStrokeBounds } from "../utils/visualBounds";

const LOADING_CYCLE_MS = 1400;
const LOADING_PADDING = 18;
const LIGHT_BAND_WIDTH = 180;
const LIGHT_TRAVEL_PX = 520;

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

const easeOutCubic = (value: number) => 1 - Math.pow(1 - value, 3);

const combineBounds = (strokes: Stroke[]): ShapeBounds | null => {
  if (strokes.length === 0) return null;

  const bounds = strokes.map(getVisualStrokeBounds);
  const minX = Math.min(...bounds.map((bound) => bound.x));
  const minY = Math.min(...bounds.map((bound) => bound.y));
  const maxX = Math.max(...bounds.map((bound) => bound.x + bound.width));
  const maxY = Math.max(...bounds.map((bound) => bound.y + bound.height));

  return {
    x: minX - LOADING_PADDING,
    y: minY - LOADING_PADDING,
    width: maxX - minX + LOADING_PADDING * 2,
    height: maxY - minY + LOADING_PADDING * 2,
  };
};

const drawMaskedLoadingSweep = (
  ctx: CanvasRenderingContext2D,
  bounds: ShapeBounds,
  now: number
) => {
  const cycleProgress = (now % LOADING_CYCLE_MS) / LOADING_CYCLE_MS;
  const phase = cycleProgress * LIGHT_TRAVEL_PX;
  const diagonalOffset = bounds.x * 0.62 + bounds.y * 0.38;
  const wrappedOffset =
    ((diagonalOffset - phase) % LIGHT_TRAVEL_PX + LIGHT_TRAVEL_PX) %
    LIGHT_TRAVEL_PX;
  const x = bounds.x - LIGHT_BAND_WIDTH + wrappedOffset - LIGHT_TRAVEL_PX;
  const gradient = ctx.createLinearGradient(
    x,
    bounds.y - LIGHT_BAND_WIDTH * 0.25,
    x + LIGHT_TRAVEL_PX + LIGHT_BAND_WIDTH,
    bounds.y + bounds.height + LIGHT_BAND_WIDTH * 0.25
  );

  gradient.addColorStop(0, "rgba(255, 255, 255, 0)");
  gradient.addColorStop(0.28, "rgba(255, 255, 255, 0)");
  gradient.addColorStop(0.42, "rgba(116, 209, 255, 0.14)");
  gradient.addColorStop(0.5, "rgba(255, 255, 255, 0.5)");
  gradient.addColorStop(0.58, "rgba(255, 176, 242, 0.14)");
  gradient.addColorStop(0.72, "rgba(255, 255, 255, 0)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = gradient;
  ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
  ctx.restore();
};

const drawSoftStrokeGlow = (
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  now: number
) => {
  const pulse =
    0.5 + Math.sin(((now % LOADING_CYCLE_MS) / LOADING_CYCLE_MS) * Math.PI * 2) * 0.5;

  ctx.save();
  ctx.globalAlpha = 0.16 + pulse * 0.05;
  ctx.shadowBlur = 5;
  ctx.shadowColor = "rgba(255, 255, 255, 0.2)";
  drawStrokes(strokes, ctx);
  ctx.restore();
};

const drawSettledStrokes = (
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  progress: number
) => {
  ctx.save();
  ctx.globalAlpha = easeOutCubic(clamp(progress / 0.18));
  drawStrokes(strokes, ctx);
  ctx.restore();
};

const drawFadingStrokes = (
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  progress: number
) => {
  const alpha = 1 - easeOutCubic(clamp(progress / 0.22));
  if (alpha <= 0) return;

  ctx.save();
  ctx.globalAlpha = alpha;
  drawStrokes(strokes, ctx);
  ctx.restore();
};

export const drawTransitionFrame = (
  ctx: CanvasRenderingContext2D,
  transition: SmartAssistTransition,
  now: number,
  reduceMotion: boolean
) => {
  const progress = reduceMotion
    ? 1
    : clamp((now - transition.startedAt) / transition.durationMs);

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  drawFadingStrokes(ctx, transition.fromStrokes, progress);
  drawSettledStrokes(ctx, transition.toStrokes, progress);
};

export const drawBatchLoadingFrame = (
  ctx: CanvasRenderingContext2D,
  batch: SmartAssistBatch,
  now: number,
  reduceMotion: boolean
) => {
  const bounds = combineBounds(batch.strokes);

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  if (!reduceMotion) {
    drawSoftStrokeGlow(ctx, batch.strokes, now);
  }
  drawStrokes(batch.strokes, ctx);

  if (!bounds || reduceMotion) return;

  drawMaskedLoadingSweep(ctx, bounds, now);
};
