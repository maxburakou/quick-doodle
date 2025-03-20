export interface SettingsState {
  color: string;
  colors: string[];
  thickness: number;
  setColor: (color: string) => void;
  setThickness: (thickness: number) => void;
}