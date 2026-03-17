import { Options } from "roughjs/bin/core";

const FALLBACK_SHAPE_FILL_COLOR = "#ffffff";
const SHAPE_FILL_VAR_NAME = "--app-shape-fill";

let cachedShapeFillColor = "";
let isThemeListenerAttached = false;

const clearShapeFillCache = () => {
  cachedShapeFillColor = "";
};

const attachThemeListener = () => {
  if (isThemeListenerAttached || typeof window === "undefined" || !window.matchMedia) {
    return;
  }

  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", clearShapeFillCache);
  isThemeListenerAttached = true;
};

const resolveShapeFillColor = (): string => {
  if (cachedShapeFillColor) {
    return cachedShapeFillColor;
  }
  if (typeof document === "undefined") return FALLBACK_SHAPE_FILL_COLOR;

  attachThemeListener();

  cachedShapeFillColor =
    getComputedStyle(document.documentElement)
    .getPropertyValue(SHAPE_FILL_VAR_NAME)
    .trim() || FALLBACK_SHAPE_FILL_COLOR;

  return cachedShapeFillColor;
};

export const getShapeFillOptions = (hasFill: boolean): Partial<Options> => {
  if (!hasFill) return {};

  return {
    fill: resolveShapeFillColor(),
    fillStyle: "solid",
  };
};
