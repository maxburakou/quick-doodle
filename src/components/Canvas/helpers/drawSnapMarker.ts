import { StrokePoint } from "@/types";

export type AxisGuideRenderData = {
  snappedAxes: Array<"x" | "y">;
  guideX?: number;
  guideY?: number;
};

export interface SnapGuidesRenderData {
  pointGuide?: Pick<StrokePoint, "x" | "y"> | null;
  axisGuides?: AxisGuideRenderData | null;
}

const SNAP_GUIDE_COLOR = "#0f62fe";
const SNAP_GUIDE_WIDTH = 1;
const SNAP_GUIDE_DASH = [1, 6];
const SNAP_GUIDE_ALPHA = 0.82;

const drawAxisGuides = (
  ctx: CanvasRenderingContext2D,
  axisGuides: AxisGuideRenderData
) => {
  const { width, height } = ctx.canvas;
  const hasX = axisGuides.snappedAxes.includes("x");
  const hasY = axisGuides.snappedAxes.includes("y");

  ctx.beginPath();

  if (hasX && axisGuides.guideX !== undefined) {
    ctx.moveTo(axisGuides.guideX, 0);
    ctx.lineTo(axisGuides.guideX, height);
  }

  if (hasY && axisGuides.guideY !== undefined) {
    ctx.moveTo(0, axisGuides.guideY);
    ctx.lineTo(width, axisGuides.guideY);
  }

  ctx.stroke();
};

export const drawSnapGuides = (
  ctx: CanvasRenderingContext2D,
  guides: SnapGuidesRenderData
) => {
  if (!guides.axisGuides) return;

  ctx.save();
  ctx.globalAlpha = SNAP_GUIDE_ALPHA;
  ctx.strokeStyle = SNAP_GUIDE_COLOR;
  ctx.lineWidth = SNAP_GUIDE_WIDTH;
  ctx.lineCap = "round";
  ctx.setLineDash(SNAP_GUIDE_DASH);

  if (guides.axisGuides) {
    drawAxisGuides(ctx, guides.axisGuides);
  }

  ctx.restore();
};
