import { Options } from "roughjs/bin/core";
import { DEFAULT_ROUGH_OPTIONS } from "@/config";

export const getRoughOptions = (options: Options) => ({
  ...DEFAULT_ROUGH_OPTIONS,
  ...options,
});
