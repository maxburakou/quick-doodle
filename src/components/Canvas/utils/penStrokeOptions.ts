import { StrokeOptions } from "perfect-freehand";


export const PEN_STROKE_OPTIONS: StrokeOptions = {
  thinning: 0.6,
  smoothing: 0.5,
  streamline: 0.5,
  easing: (t: number) => Math.sin((t * Math.PI) / 2),
  start: { cap: true, taper: 0, easing: (t: number) => t },
  end: { cap: true, taper: 0, easing: (t: number) => t },
};
