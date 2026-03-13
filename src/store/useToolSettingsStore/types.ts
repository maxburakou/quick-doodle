export interface ToolSettingsState {
  color: string;
  colors: string[];
  thickness: number;
  thicknesses: number[];
  shapeFill: boolean;
  setColor: (color: string) => void;
  setThickness: (thickness: number) => void;
  setShapeFill: (enabled: boolean) => void;
  updateColor: (newColor: string) => void;
  toNextColor: () => void;
  toPrevColor: () => void;
  toNextThickness: () => void;
  toPrevThickness: () => void;
}
