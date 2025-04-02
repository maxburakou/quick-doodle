export interface TextSettingsState {
  fontSize: number;
  fontSizes: number[];
}

export interface TextSettingsActions {
  setFontSize: (fontSize: number) => void;
  updateFontSize: (newFontSize: number) => void;
  toNextFontSize: () => void;
  toPrevFontSize: () => void;
}
