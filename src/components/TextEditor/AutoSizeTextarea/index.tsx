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
import {
  getBoxStartFromCaret,
  getCaretFromBoxStart,
  getTextLayout,
} from "@/components/Canvas/utils/textLayout";
import { StrokePoint, Tool } from "@/types";
import { handleInputSubmit } from "../helpers";

type TextBounds = { x: number; y: number; width: number; height: number };
type EditorPlacement = {
  left: number;
  top: number;
  transform: string | undefined;
  transformOrigin: "top left" | "center center";
};

const resolveEditorPlacement = ({
  mode,
  rotation,
  editingTextBounds,
  boxStart,
}: {
  mode: "idle" | "create" | "edit";
  rotation: number;
  editingTextBounds: TextBounds | null;
  boxStart: Pick<StrokePoint, "x" | "y">;
}): EditorPlacement => {
  const basePlacement: EditorPlacement = {
    left: boxStart.x,
    top: boxStart.y,
    transform: undefined,
    transformOrigin: "top left",
  };

  if (mode !== "edit" || !rotation) return basePlacement;
  if (!editingTextBounds) {
    return {
      ...basePlacement,
      transform: `rotate(${rotation}rad)`,
    };
  }

  return {
    left: editingTextBounds.x + editingTextBounds.width / 2,
    top: editingTextBounds.y + editingTextBounds.height / 2,
    transform: `translate(-50%, -50%) rotate(${rotation}rad)`,
    transformOrigin: "center center",
  };
};

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
    const fontSize = mode === "edit" ? activeFontSize : fontSizeSnapshot ?? activeFontSize;
    const layout = getTextLayout(fontSize, text);
    const { lineHeight } = layout.metrics;
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
    const caretX = editingTextBounds?.x ?? point?.x ?? 0;
    const caretY =
      mode === "edit" && editingTextBounds
        ? getCaretFromBoxStart(
            { x: editingTextBounds.x, y: editingTextBounds.y },
            fontSize
          ).y
        : point?.y ?? 0;
    const boxStart = getBoxStartFromCaret({ x: caretX, y: caretY }, fontSize);
    const placement = resolveEditorPlacement({
      mode,
      rotation,
      editingTextBounds,
      boxStart,
    });
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
          top: placement.top,
          left: placement.left,
          color,
          fontSize,
          lineHeight: `${lineHeight}px`,
          transform: placement.transform,
          transformOrigin: placement.transformOrigin,
        }}
      >
        <textarea
          ref={textareaRef}
          className="canvas-textarea"
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
