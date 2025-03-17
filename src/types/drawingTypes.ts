export enum Tool {
  Pen = "1",
  Highlighter = "2",
  Line = "3",
  Arrow = "4",
  Rectangle = "5",
  Ellipse = "6",
  Text = "7",
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
  drawableSeed?: number;
}
