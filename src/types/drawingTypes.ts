export enum Tool {
  Pen = "1",
  Highlighter = "2",
  Arrow = "3",
  Line = "4",
  Rectangle = "5",
  Diamond = "6",
  Ellipse = "7",
  Text = "8",
  Select = "9",
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

export interface ShapeBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type EditableShapeTool =
  | Tool.Arrow
  | Tool.Line
  | Tool.Rectangle
  | Tool.Diamond
  | Tool.Ellipse;

export type TransformHandle =
  | "move"
  | "n"
  | "s"
  | "e"
  | "w"
  | "ne"
  | "nw"
  | "se"
  | "sw"
  | "rotate";

export interface TransformSession {
  strokeId: string;
  handle: TransformHandle;
  startPointer: StrokePoint;
  initialStroke: Stroke;
  draftStroke: Stroke;
  initialBounds: ShapeBounds;
  initialRotation: number;
  startPointerAngle?: number;
}

export interface Stroke {
  id: string;
  points: StrokePoint[];
  color: string;
  thickness: number;
  tool: Tool;
  drawableSeed?: number;
  isShiftPressed?: boolean;
  rotation?: number;
  text?: TextElement;
}
