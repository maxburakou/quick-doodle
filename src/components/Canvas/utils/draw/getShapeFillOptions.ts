import { Options } from "roughjs/bin/core";
import { useThemeStore } from "@/store/useThemeStore";

const FALLBACK_SHAPE_FILL_COLOR = "#ffffff";
const SHAPE_FILL_VAR_NAME = "--app-shape-fill";
let cachedShapeFill:
  | {
      key: string;
      color: string;
    }
  | null = null;

const resolveShapeFillColor = (): string => {
  if (typeof document === "undefined") return FALLBACK_SHAPE_FILL_COLOR;

  const key = useThemeStore.getState().effectiveTheme;
  if (cachedShapeFill?.key === key) {
    return cachedShapeFill.color;
  }

  const color =
    getComputedStyle(document.documentElement)
      .getPropertyValue(SHAPE_FILL_VAR_NAME)
      .trim() || FALLBACK_SHAPE_FILL_COLOR;

  cachedShapeFill = { key, color };
  return color;
};

export const getShapeFillOptions = (
  hasFill: boolean
): Partial<Options> => {
  if (!hasFill) return {};

  return {
    fill: resolveShapeFillColor(),
    fillStyle: "solid",
  };
};
