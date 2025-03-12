export enum Tool {
  Pen,
  Highlighter,
  Line,
  Arrow,
  Rectangle,
  Ellipse,
  Text,
}

export interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
}

export interface Stroke {
  points: StrokePoint[];
  color: string;
  thickness: number;
  tool: Tool;
}