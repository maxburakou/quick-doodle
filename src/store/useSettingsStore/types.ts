export interface SettingsState {
  color: string;
  thickness: number;
  setColor: (color: string) => void;
  setThickness: (thickness: number) => void;
}