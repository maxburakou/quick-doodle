import { useSelectedStrokes } from "./useSelectedStrokes";

export const useSingleSelectedStroke = () => {
  const selectedStrokes = useSelectedStrokes();
  return selectedStrokes.length === 1 ? selectedStrokes[0] : null;
};
