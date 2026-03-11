import getStroke from "perfect-freehand";
import { Drawable } from "roughjs/bin/core";
import { ShapeBounds, Stroke, Tool } from "@/types";
import { getStrokeDrawables } from "./generateRoughShape";
import { PEN_STROKE_OPTIONS } from "./penStrokeOptions";
import { getHighlighterStrokeWidth } from "./draw/drawHighlighter";
import { normalizeBoundsFromPoints } from "@/store/useShapeEditorStore/helpers/core";

export interface CachedStrokeGeometry {
  
  penPolygon: number[][] | null;
  
  roughDrawables: Drawable[] | null;
  
  hitTestPath: Path2D | null;
  
  visualBounds: ShapeBounds;
}

const CACHE_MAX_SIZE = 500;
const cache = new Map<string, CachedStrokeGeometry>();

const toCacheKey = (stroke: Stroke): string => {
  const pointsHash = stroke.points
    .filter((_, i, arr) => i === 0 || i === arr.length - 1 || i % 10 === 0)
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join("|");

  return [
    stroke.id,
    stroke.tool,
    stroke.thickness,
    stroke.drawableSeed ?? 0,
    stroke.isShiftPressed ? 1 : 0,
    pointsHash,
  ].join(":");
};

const evictOldest = () => {
  if (cache.size <= CACHE_MAX_SIZE) return;
  const oldestKey = cache.keys().next().value;
  if (typeof oldestKey === "string") {
    cache.delete(oldestKey);
  }
};



const computePenPolygon = (stroke: Stroke): number[][] => {
  if (stroke.points.length === 0) return [];
  return getStroke(
    stroke.points.map(({ x, y }) => [x, y]),
    { ...PEN_STROKE_OPTIONS, size: stroke.thickness }
  );
};

const buildPenHitTestPath = (polygon: number[][]): Path2D | null => {
  if (polygon.length === 0) return null;
  const path = new Path2D();
  path.moveTo(polygon[0][0], polygon[0][1]);
  for (let i = 1; i < polygon.length - 1; i++) {
    const [x0, y0] = polygon[i];
    const [x1, y1] = polygon[i + 1];
    path.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  }
  path.closePath();
  return path;
};

const boundsFromPolygon = (polygon: number[][]): ShapeBounds => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of polygon) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};



const buildRoughHitTestPath = (drawables: Drawable[]): Path2D | null => {
  if (drawables.length === 0) return null;
  const path = new Path2D();
  for (const drawable of drawables) {
    for (const set of drawable.sets) {
      for (const op of set.ops) {
        if (op.op === "move") path.moveTo(op.data[0], op.data[1]);
        else if (op.op === "lineTo") path.lineTo(op.data[0], op.data[1]);
        else if (op.op === "bcurveTo")
          path.bezierCurveTo(
            op.data[0], op.data[1],
            op.data[2], op.data[3],
            op.data[4], op.data[5]
          );
      }
    }
  }
  return path;
};

const boundsFromDrawables = (drawables: Drawable[]): ShapeBounds | null => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const drawable of drawables) {
    for (const set of drawable.sets) {
      for (const op of set.ops) {
        const coords =
          op.op === "bcurveTo"
            ? [op.data[0], op.data[1], op.data[2], op.data[3], op.data[4], op.data[5]]
            : op.op === "move" || op.op === "lineTo"
              ? [op.data[0], op.data[1]]
              : [];
        for (let i = 0; i < coords.length; i += 2) {
          const x = coords[i];
          const y = coords[i + 1];
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
  }

  if (minX === Infinity) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};



const computeGeometry = (stroke: Stroke): CachedStrokeGeometry => {
  
  if (stroke.tool === Tool.Text) {
    const start = stroke.points[0];
    const end = stroke.points[stroke.points.length - 1] ?? start;
    return {
      penPolygon: null,
      roughDrawables: null,
      hitTestPath: null,
      visualBounds: normalizeBoundsFromPoints(start, end),
    };
  }

  
  if (stroke.tool === Tool.Pen) {
    const polygon = computePenPolygon(stroke);
    if (polygon.length === 0) {
      const fallback = normalizeBoundsFromPoints(stroke.points[0], stroke.points[0]);
      return { penPolygon: polygon, roughDrawables: null, hitTestPath: null, visualBounds: fallback };
    }
    return {
      penPolygon: polygon,
      roughDrawables: null,
      hitTestPath: buildPenHitTestPath(polygon),
      visualBounds: boundsFromPolygon(polygon),
    };
  }

  
  const drawables = getStrokeDrawables(stroke);
  const drawableBounds = boundsFromDrawables(drawables);
  const fallbackBounds = normalizeBoundsFromPoints(
    stroke.points[0],
    stroke.points[stroke.points.length - 1] ?? stroke.points[0]
  );

  let visualExpansion = stroke.thickness / 2;
  if (stroke.tool === Tool.Highlighter) {
    visualExpansion = getHighlighterStrokeWidth(stroke.thickness) / 2;
  }

  const rawBounds = drawableBounds ?? fallbackBounds;
  const visualBounds = {
    x: rawBounds.x - visualExpansion,
    y: rawBounds.y - visualExpansion,
    width: rawBounds.width + visualExpansion * 2,
    height: rawBounds.height + visualExpansion * 2,
  };

  return {
    penPolygon: null,
    roughDrawables: drawables,
    hitTestPath: buildRoughHitTestPath(drawables),
    visualBounds,
  };
};



export const getCachedStrokeGeometry = (stroke: Stroke): CachedStrokeGeometry => {
  const key = toCacheKey(stroke);
  const cached = cache.get(key);
  if (cached) return cached;

  const geometry = computeGeometry(stroke);
  cache.set(key, geometry);
  evictOldest();
  return geometry;
};


export const getCachedVisualBounds = (stroke: Stroke): ShapeBounds =>
  getCachedStrokeGeometry(stroke).visualBounds;


export const getCachedPenPolygon = (stroke: Stroke): number[][] | null =>
  getCachedStrokeGeometry(stroke).penPolygon;


export const getCachedHitTestPath = (stroke: Stroke): Path2D | null =>
  getCachedStrokeGeometry(stroke).hitTestPath;
