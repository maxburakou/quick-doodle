import { StrokePoint } from "@/types";
import { useThemeStore } from "@/store/useThemeStore";
import {
  PRIMARY_COLORS_BY_THEME,
  SNAP_GUIDE_DASH,
  SNAP_GUIDE_WIDTH,
} from "@/config";

export type AxisGuideRenderData = {
  snappedAxes: Array<"x" | "y">;
  guideX?: number;
  guideY?: number;
};

export interface SnapGuidesRenderData {
  pointGuide?: Pick<StrokePoint, "x" | "y"> | null;
  axisGuides?: AxisGuideRenderData | null;
}

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

  const accentColor = PRIMARY_COLORS_BY_THEME[useThemeStore.getState().effectiveTheme];

  ctx.save();
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = SNAP_GUIDE_WIDTH;
  ctx.lineCap = "round";
  ctx.setLineDash(SNAP_GUIDE_DASH);

  if (guides.axisGuides) {
    drawAxisGuides(ctx, guides.axisGuides);
  }

  ctx.restore();
};
