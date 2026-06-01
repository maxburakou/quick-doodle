import { StrokePoint } from "@/types";

type SnapGuideKind = "axis" | "diagonal";

const GUIDE_ANGLES = [
  { angleDeg: 0, kind: "axis" },
  { angleDeg: 45, kind: "diagonal" },
  { angleDeg: 90, kind: "axis" },
  { angleDeg: 135, kind: "diagonal" },
] as const;

const AXIS_MAX_ANGLE_DELTA_DEG = 8;
const DIAGONAL_MAX_ANGLE_DELTA_DEG = 5;
const AXIS_MAX_ENDPOINT_SHIFT_RATIO = 0.14;
const DIAGONAL_MAX_ENDPOINT_SHIFT_RATIO = 0.1;
const AXIS_MIN_ENDPOINT_SHIFT_PX = 16;
const DIAGONAL_MIN_ENDPOINT_SHIFT_PX = 14;
const AXIS_MAX_ENDPOINT_SHIFT_PX = 36;
const DIAGONAL_MAX_ENDPOINT_SHIFT_PX = 30;

const radiansToDegrees = (radians: number): number => (radians * 180) / Math.PI;
const degreesToRadians = (degrees: number): number => (degrees * Math.PI) / 180;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const normalizeAngleDelta = (deltaDeg: number): number => {
  let normalized = deltaDeg;
  while (normalized > 180) normalized -= 360;
  while (normalized <= -180) normalized += 360;
  return normalized;
};

const normalizeAngleDeg = (angleDeg: number): number => {
  let normalized = angleDeg % 360;
  if (normalized < 0) normalized += 360;
  return normalized;
};

const getLineAngleDelta = (angleDeg: number, guideAngleDeg: number): number =>
  Math.min(
    Math.abs(normalizeAngleDelta(angleDeg - guideAngleDeg)),
    Math.abs(normalizeAngleDelta(angleDeg - guideAngleDeg - 180))
  );

const getGuideThresholds = (kind: SnapGuideKind, length: number) => {
  if (kind === "axis") {
    return {
      maxAngleDeltaDeg: AXIS_MAX_ANGLE_DELTA_DEG,
      maxEndpointShiftPx: clamp(
        length * AXIS_MAX_ENDPOINT_SHIFT_RATIO,
        AXIS_MIN_ENDPOINT_SHIFT_PX,
        AXIS_MAX_ENDPOINT_SHIFT_PX
      ),
    };
  }

  return {
    maxAngleDeltaDeg: DIAGONAL_MAX_ANGLE_DELTA_DEG,
    maxEndpointShiftPx: clamp(
      length * DIAGONAL_MAX_ENDPOINT_SHIFT_RATIO,
      DIAGONAL_MIN_ENDPOINT_SHIFT_PX,
      DIAGONAL_MAX_ENDPOINT_SHIFT_PX
    ),
  };
};

export interface AngleSnapIntent {
  shouldSnap: boolean;
  guideKind: SnapGuideKind | null;
  angleDeg: number;
  snappedAngleDeg: number;
  deltaDeg: number;
  endpointShiftPx: number;
  snappedEnd: StrokePoint;
  maxDeltaDeg: number;
  maxEndpointShiftPx: number;
}

export const getAngleSnapIntent = (
  start: StrokePoint,
  end: StrokePoint
): AngleSnapIntent => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  const angleDeg = radiansToDegrees(Math.atan2(end.y - start.y, end.x - start.x));
  const candidates = GUIDE_ANGLES.map((guide) => {
    const radians = degreesToRadians(guide.angleDeg);
    const ux = Math.cos(radians);
    const uy = Math.sin(radians);
    const projection = dx * ux + dy * uy;
    const snappedEnd = {
      x: start.x + ux * projection,
      y: start.y + uy * projection,
      pressure: end.pressure,
    };
    const endpointShiftPx = Math.hypot(end.x - snappedEnd.x, end.y - snappedEnd.y);
    const snappedAngleDeg = normalizeAngleDeg(
      guide.angleDeg + (projection < 0 ? 180 : 0)
    );
    const deltaDeg = getLineAngleDelta(angleDeg, guide.angleDeg);
    return {
      ...guide,
      snappedAngleDeg,
      snappedEnd,
      endpointShiftPx,
      deltaDeg,
    };
  }).sort((left, right) => left.endpointShiftPx - right.endpointShiftPx);

  const best = candidates[0];
  const thresholds = best ? getGuideThresholds(best.kind, length) : null;
  const shouldSnap = Boolean(
    best &&
      thresholds &&
      best.deltaDeg <= thresholds.maxAngleDeltaDeg &&
      best.endpointShiftPx <= thresholds.maxEndpointShiftPx
  );

  return {
    shouldSnap,
    guideKind: shouldSnap && best ? best.kind : null,
    angleDeg,
    snappedAngleDeg: best?.snappedAngleDeg ?? angleDeg,
    deltaDeg: best?.deltaDeg ?? 0,
    endpointShiftPx: best?.endpointShiftPx ?? 0,
    snappedEnd: shouldSnap && best ? best.snappedEnd : end,
    maxDeltaDeg: thresholds?.maxAngleDeltaDeg ?? 0,
    maxEndpointShiftPx: thresholds?.maxEndpointShiftPx ?? 0,
  };
};
