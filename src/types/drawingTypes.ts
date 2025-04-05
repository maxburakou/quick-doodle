export enum Tool {
  Pen = "1",
  Highlighter = "2",
  Arrow = "3",
  Line = "4",
  Rectangle = "5",
  Diamond = "6",
  Ellipse = "7",
  Text = "8",
}

export interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
}

export interface TextElement {
  value: string;
  fontSize: number;
}

export interface Stroke {
  points: StrokePoint[];
  color: string;
  thickness: number;
  tool: Tool;
  drawableSeed?: number;
  isShiftPressed?: boolean;
  text?: TextElement;
}
