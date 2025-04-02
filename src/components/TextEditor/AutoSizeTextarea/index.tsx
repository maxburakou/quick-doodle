import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import "./styles.css";
import {
  useFontSize,
  useResetTextEditorState,
  useSetTextEditorInputText,
  useTextEditorInputText,
  useTextEditorStartPoint,
  useToolColor,
} from "@/store";
import { handleInputSubmit } from "../helpers";

export const AutoSizeTextarea = forwardRef<HTMLTextAreaElement>(
  (_props, ref) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const text = useTextEditorInputText();
    const setText = useSetTextEditorInputText();

    const point = useTextEditorStartPoint();
    const reset = useResetTextEditorState();

    const color = useToolColor();
    const fontSize = useFontSize();

    useImperativeHandle(
      ref,
      () => textareaRef.current as HTMLTextAreaElement,
      []
    );

    useEffect(() => {
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    }, []);

    return (
      <label
        className="input-sizer stacked"
        data-value={text || " "}
        style={{ top: point?.y, left: point?.x, color, fontSize }}
      >
        <textarea
          ref={textareaRef}
          className={`canvas-textarea`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={1}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Escape") {
              e.preventDefault();
              reset();
            }
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleInputSubmit();
            }
          }}
          onBlur={() => textareaRef.current?.blur()}
          onPointerDown={(e) => e.stopPropagation()}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
        />
      </label>
    );
  }
);
