import { StrokePoint } from "@/types";

const SNAP_GUIDE_COLOR = "#0f62fe";
const SNAP_GUIDE_WIDTH = 1;
const SNAP_GUIDE_DASH = [6, 4];
const SNAP_GUIDE_ALPHA = 0.82;
const SNAP_GUIDE_INSET = 6;
const SNAP_CENTER_RADIUS = 2;

export const drawSnapGuides = (
  ctx: CanvasRenderingContext2D,
  point: Pick<StrokePoint, "x" | "y">
) => {
  const { width, height } = ctx.canvas;
  const minX = SNAP_GUIDE_INSET;
  const minY = SNAP_GUIDE_INSET;
  const maxX = Math.max(minX, width - SNAP_GUIDE_INSET);
  const maxY = Math.max(minY, height - SNAP_GUIDE_INSET);

  ctx.save();

  ctx.globalAlpha = SNAP_GUIDE_ALPHA;
  ctx.strokeStyle = SNAP_GUIDE_COLOR;
  ctx.lineWidth = SNAP_GUIDE_WIDTH;
  ctx.setLineDash(SNAP_GUIDE_DASH);

  ctx.beginPath();
  ctx.moveTo(minX, point.y);
  ctx.lineTo(maxX, point.y);
  ctx.moveTo(point.x, minY);
  ctx.lineTo(point.x, maxY);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(point.x, point.y, SNAP_CENTER_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = SNAP_GUIDE_COLOR;
  ctx.fill();

  ctx.restore();
};
