import { DEFAULT_FONT_SIZE_LABELS } from "@/config";

export const getFontSizeLabel = (index: number): string => {
  return DEFAULT_FONT_SIZE_LABELS[index] || "C";
};
