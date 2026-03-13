export interface SnapState {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  toggleEnabled: () => void;
}
