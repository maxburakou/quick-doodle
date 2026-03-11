import { ShapeBounds, Stroke } from "@/types";
import { getCachedVisualBounds } from "./strokeShapeCache";


export const getVisualStrokeBounds = (stroke: Stroke): ShapeBounds =>
  getCachedVisualBounds(stroke);
