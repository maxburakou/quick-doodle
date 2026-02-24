export const SNAP_DISTANCE_PX = 10;

export const ELLIPSE_ANCHOR_ANGLES = [
  0,
  45,
  90,
  135,
  180,
  225,
  270,
  315,
] as const;

export const SNAP_PRIORITY_ORDER = {
  corner: 0,
  edgeMid: 1,
  center: 2,
  ellipseAxis: 3,
  lineEnd: 4,
  lineMid: 5,
} as const;
