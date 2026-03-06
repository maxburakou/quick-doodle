import { Options } from "roughjs/bin/core";

const FIXED_FILL_COLOR = "#f8f9fb";

export const getShapeFillOptions = (hasFill: boolean): Partial<Options> => {
  if (!hasFill) return {};

  return {
    fill: FIXED_FILL_COLOR,
    fillStyle: "solid",
  };
};
