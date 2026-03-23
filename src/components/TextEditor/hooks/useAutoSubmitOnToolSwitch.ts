import { useEffect, useRef, type RefObject } from "react";
import { Tool } from "@/types";
import { useTextEditorMode, useTool } from "@/store";
import { handleInputSubmit } from "../helpers";

export const useAutoSubmitOnToolSwitch = (
  inputRef: RefObject<HTMLTextAreaElement>
) => {
  const tool = useTool();
  const mode = useTextEditorMode();
  const prevToolRef = useRef(tool);

  useEffect(() => {
    const toolChanged = prevToolRef.current !== tool;
    const switchedAwayFromText = tool !== Tool.Text;

    if (toolChanged && switchedAwayFromText && (mode === "create" || mode === "edit")) {
      handleInputSubmit();
      inputRef.current?.blur();
    }

    prevToolRef.current = tool;
  }, [tool, mode, inputRef]);
};
