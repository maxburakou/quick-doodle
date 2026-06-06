import {
  SmartAssistBatch,
  SmartAssistTransition,
} from "@/features/smartAssist/types";
import { ShapeBounds, Stroke, Tool } from "@/types";
import { drawPenStroke, drawStrokes } from "../utils/draw";
import { getCachedPenPolygon } from "../utils/strokeShapeCache";
import { getVisualStrokeBounds } from "../utils/visualBounds";

const LOADING_CYCLE_MS = 1400;
const LOADING_PADDING = 18;
const LIGHT_BAND_WIDTH = 180;
const SWEEP_VECTOR = (() => {
  const x = 0.62;
  const y = 0.38;
  const length = Math.hypot(x, y);

  return {
    x: x / length,
    y: y / length,
  };
})();

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

const easeOutCubic = (value: number) => 1 - Math.pow(1 - value, 3);
const easeInCubic = (value: number) => value * value * value;
const easeInOutCubic = (value: number) =>
  value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;

const projectToSweepAxis = (x: number, y: number) =>
  x * SWEEP_VECTOR.x + y * SWEEP_VECTOR.y;

const getSweepProjectionRange = (bounds: ShapeBounds) => {
  const right = bounds.x + bounds.width;
  const bottom = bounds.y + bounds.height;
  const projections = [
    projectToSweepAxis(bounds.x, bounds.y),
    projectToSweepAxis(right, bounds.y),
    projectToSweepAxis(bounds.x, bottom),
    projectToSweepAxis(right, bottom),
  ];

  return {
    min: Math.min(...projections),
    max: Math.max(...projections),
  };
};

const getSweepAxisPoint = (projection: number) => ({
  x: SWEEP_VECTOR.x * projection,
  y: SWEEP_VECTOR.y * projection,
});

const combineBounds = (
  strokes: Stroke[],
  padding: number = 0
): ShapeBounds | null => {
  if (strokes.length === 0) return null;

  const bounds = strokes.map(getVisualStrokeBounds);
  const minX = Math.min(...bounds.map((bound) => bound.x));
  const minY = Math.min(...bounds.map((bound) => bound.y));
  const maxX = Math.max(...bounds.map((bound) => bound.x + bound.width));
  const maxY = Math.max(...bounds.map((bound) => bound.y + bound.height));

  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  };
};

const getTransitionCenter = (
  fromStrokes: Stroke[],
  toStrokes: Stroke[]
) => {
  const bounds = combineBounds([...fromStrokes, ...toStrokes]);

  return bounds
    ? {
        x: bounds.x + bounds.width / 2,
        y: bounds.y + bounds.height / 2,
      }
    : { x: 0, y: 0 };
};

const drawMaskedLoadingSweep = (
  ctx: CanvasRenderingContext2D,
  bounds: ShapeBounds,
  elapsedMs: number
) => {
  const cycleProgress =
    (((elapsedMs % LOADING_CYCLE_MS) + LOADING_CYCLE_MS) %
      LOADING_CYCLE_MS) /
    LOADING_CYCLE_MS;
  const projectionRange = getSweepProjectionRange(bounds);
  const travelDistance =
    Math.max(1, projectionRange.max - projectionRange.min) +
    LIGHT_BAND_WIDTH * 2;
  const centerProjection =
    projectionRange.min - LIGHT_BAND_WIDTH + cycleProgress * travelDistance;
  const start = getSweepAxisPoint(centerProjection - LIGHT_BAND_WIDTH);
  const end = getSweepAxisPoint(centerProjection + LIGHT_BAND_WIDTH);
  const gradient = ctx.createLinearGradient(
    start.x,
    start.y,
    end.x,
    end.y
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
  drawSmartAssistStrokes(strokes, ctx);
  ctx.restore();
};

const drawSmartAssistStrokes = (
  strokes: Stroke[],
  ctx: CanvasRenderingContext2D
) => {
  strokes.forEach((stroke) => {
    if (stroke.tool === Tool.Pen) {
      drawPenStroke(
        ctx,
        stroke.points,
        stroke.color,
        stroke.thickness,
        getCachedPenPolygon(stroke)
      );
      return;
    }

    drawStrokes([stroke], ctx);
  });
};

const drawAppearingStrokes = (
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  progress: number,
  center: { x: number; y: number }
) => {
  const revealProgress = easeOutCubic(clamp((progress - 0.36) / 0.34));
  if (revealProgress <= 0) return;

  ctx.save();
  ctx.globalAlpha = revealProgress;
  ctx.translate(center.x, center.y);
  ctx.scale(0.96 + revealProgress * 0.04, 0.96 + revealProgress * 0.04);
  ctx.translate(-center.x, -center.y);
  drawSmartAssistStrokes(strokes, ctx);
  ctx.restore();
};

const drawShrinkingStrokes = (
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  progress: number,
  center: { x: number; y: number }
) => {
  const fadeProgress = easeInOutCubic(clamp(progress / 0.62));
  const alpha = 1 - fadeProgress;
  if (alpha <= 0) return;

  const scale = Math.max(0.01, 1 - easeInCubic(fadeProgress));

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(center.x, center.y);
  ctx.scale(scale, scale);
  ctx.translate(-center.x, -center.y);
  drawSmartAssistStrokes(strokes, ctx);
  ctx.restore();
};

const shouldDrawLoadingEffect = (batch: SmartAssistBatch) =>
  batch.status !== "recognizing-text";

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
  const center = getTransitionCenter(
    transition.fromStrokes,
    transition.toStrokes
  );
  drawShrinkingStrokes(ctx, transition.fromStrokes, progress, center);
  drawAppearingStrokes(ctx, transition.toStrokes, progress, center);
};

export const drawBatchLoadingFrame = (
  ctx: CanvasRenderingContext2D,
  batch: SmartAssistBatch,
  now: number,
  reduceMotion: boolean
) => {
  const drawLoadingEffect = shouldDrawLoadingEffect(batch);
  const bounds = drawLoadingEffect
    ? combineBounds(batch.strokes, LOADING_PADDING)
    : null;

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  if (!reduceMotion && drawLoadingEffect) {
    drawSoftStrokeGlow(ctx, batch.strokes, now);
  }
  drawSmartAssistStrokes(batch.strokes, ctx);

  if (!bounds || reduceMotion) return;

  drawMaskedLoadingSweep(ctx, bounds, now - batch.startedAt);
};
