export interface ToolSettingsState {
  color: string;
  colors: string[];
  thickness: number;
  setColor: (color: string) => void;
  setThickness: (thickness: number) => void;
  updateColor: (newColor: string) => void;
}
