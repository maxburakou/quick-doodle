import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import "./styles.css";
import {
  useCancelTextEditor,
  useFontSize,
  usePresent,
  useSetTextEditorInputText,
  useTextEditorEditingStrokeId,
  useTextEditorFontSizeSnapshot,
  useTextEditorInputText,
  useTextEditorMode,
  useTextEditorStartPoint,
  useToolColor,
} from "@/store";
import { getTextBounds } from "@/components/Canvas/utils/textGeometry";
import { Tool } from "@/types";
import { handleInputSubmit } from "../helpers";

export const AutoSizeTextarea = forwardRef<HTMLTextAreaElement>(
  (_props, ref) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const text = useTextEditorInputText();
    const setText = useSetTextEditorInputText();
    const mode = useTextEditorMode();
    const editingStrokeId = useTextEditorEditingStrokeId();
    const fontSizeSnapshot = useTextEditorFontSizeSnapshot();

    const point = useTextEditorStartPoint();
    const cancel = useCancelTextEditor();
    const present = usePresent();

    const color = useToolColor();
    const activeFontSize = useFontSize();
    const fontSize = fontSizeSnapshot ?? activeFontSize;
    const editingStroke = editingStrokeId
      ? present.find((stroke) => stroke.id === editingStrokeId)
      : null;
    const rotation = editingStroke?.rotation ?? 0;
    const editingTextBounds =
      mode === "edit" &&
      editingStroke?.tool === Tool.Text &&
      editingStroke.text
        ? getTextBounds(editingStroke)
        : null;
    const useCenteredRotationAnchor =
      mode === "edit" && Boolean(rotation) && Boolean(editingTextBounds);
    const editorLeft = useCenteredRotationAnchor
      ? (editingTextBounds?.x ?? 0) + (editingTextBounds?.width ?? 0) / 2
      : editingTextBounds?.x ?? point?.x;
    const editorTop = useCenteredRotationAnchor
      ? (editingTextBounds?.y ?? 0) + (editingTextBounds?.height ?? 0) / 2
      : editingTextBounds?.y ?? point?.y;
    const rotationTransform =
      mode === "edit" && rotation
        ? useCenteredRotationAnchor
          ? `translate(-50%, -50%) rotate(${rotation}rad)`
          : `rotate(${rotation}rad)`
        : undefined;
    const sizerValue =
      text.length === 0 ? "." : text.endsWith("\n") ? `${text} ` : text;

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

    useEffect(() => {
      if (mode !== "edit") return;
      if (!editingStrokeId) {
        cancel();
        return;
      }
      const exists = present.some((stroke) => stroke.id === editingStrokeId);
      if (!exists) {
        cancel();
      }
    }, [mode, editingStrokeId, present, cancel]);

    return (
      <label
        className="input-sizer stacked"
        data-value={sizerValue}
        style={{
          top: editorTop,
          left: editorLeft,
          color,
          fontSize,
          transform: rotationTransform,
          transformOrigin: useCenteredRotationAnchor ? "center center" : "top left",
        }}
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
              cancel();
            }
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleInputSubmit();
            }
          }}
          onBlur={() => {
            if (mode === "create" || mode === "edit") {
              handleInputSubmit();
            }
          }}
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
