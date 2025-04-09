export interface ToolSettingsState {
  color: string;
  colors: string[];
  thickness: number;
  thicknesses: number[];
  setColor: (color: string) => void;
  setThickness: (thickness: number) => void;
  updateColor: (newColor: string) => void;
  toNextColor: () => void;
  toPrevColor: () => void;
  toNextThickness: () => void;
  toPrevThickness: () => void;
}
