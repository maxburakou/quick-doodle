import { Stroke } from "@/types";

export interface ClipboardState {
  strokesSnapshot: Stroke[];
  pasteCount: number;
  lastPasteIds: string[];
  copySelection: () => boolean;
  cutSelection: () => boolean;
  pasteFromClipboard: () => boolean;
  hasData: () => boolean;
}
