const HIGHLIGHTER_STROKE_WIDTH_MULTIPLIER = 5;

export const getHighlighterStrokeWidth = (thickness: number) =>
  Math.max(1, thickness * HIGHLIGHTER_STROKE_WIDTH_MULTIPLIER);

export const getHighlighterHitRadius = (thickness: number) =>
  getHighlighterStrokeWidth(thickness) / 2;
