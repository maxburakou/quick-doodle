import { useEffect } from "react";
import { useShapeEditorStore } from "@/store/useShapeEditorStore";
import { useHistoryStore } from "@/store/useHistoryStore";
import { useTextEditorStore } from "@/store/useTextEditorStore";
import { Tool } from "@/types";
import { SnapGuidesRenderData } from "../helpers/drawSnapMarker";
import {
  clearCanvas,
  drawSnapGuides,
  drawGroupSelectionOverlay,
  drawShapeEditorOverlay,
} from "../helpers";
import { drawStrokes, getTransformLayerFromSession } from "../utils";

interface UseSelectModeOverlayParams {
  ctxRef: React.MutableRefObject<CanvasRenderingContext2D | null>;
  tool: Tool;
  isSnapEnabled: boolean;
  activeSnapGuidesRef: React.MutableRefObject<SnapGuidesRenderData | null>;
  renderOverlayRef: React.MutableRefObject<() => void>;
}

export const useSelectModeOverlay = ({
  ctxRef,
  tool,
  isSnapEnabled,
  activeSnapGuidesRef,
  renderOverlayRef,
}: UseSelectModeOverlayParams) => {
  const textEditorMode = useTextEditorStore((state) => state.mode);

  useEffect(() => {
    renderOverlayRef.current = () => {
      if (textEditorMode === "edit") {
        clearCanvas(ctxRef.current);
        return;
      }

      if (tool !== Tool.Select) {
        return;
      }

      const {
        session,
        selectedStrokeIdSet,
        primarySelectedStrokeId,
      } = useShapeEditorStore.getState();
      const { present } = useHistoryStore.getState();

      const selectedStrokes = present.filter((stroke) =>
        selectedStrokeIdSet.has(stroke.id)
      );
      const primarySelectedStroke =
        present.find((stroke) => stroke.id === primarySelectedStrokeId) ?? null;

      const transformLayer = getTransformLayerFromSession(session);

      const ctx = ctxRef.current;
      if (!ctx) return;

      clearCanvas(ctx);
      if (transformLayer.isTransforming) {
        drawStrokes(transformLayer.activeStrokes, ctx);
      }

      if (session?.type === "single") {
        const shouldRenderPenAsGroup = session.initialStroke.tool === Tool.Pen;
        if (shouldRenderPenAsGroup) {
          drawGroupSelectionOverlay(ctx, [session.draftStroke]);
        } else {
          drawShapeEditorOverlay(ctx, session.draftStroke);
        }
      } else if (session?.type === "groupMove") {
        const draftStrokes = session.strokeIds
          .map((id) => session.draftStrokesById[id])
          .filter(Boolean);
        drawGroupSelectionOverlay(ctx, draftStrokes);
      } else if (selectedStrokes.length > 1) {
        drawGroupSelectionOverlay(ctx, selectedStrokes);
      } else if (primarySelectedStroke) {
        if (primarySelectedStroke.tool === Tool.Pen) {
          drawGroupSelectionOverlay(ctx, [primarySelectedStroke]);
        } else {
          drawShapeEditorOverlay(ctx, primarySelectedStroke);
        }
      }

      if (isSnapEnabled && activeSnapGuidesRef.current) {
        drawSnapGuides(ctx, activeSnapGuidesRef.current);
      }
    };

    renderOverlayRef.current();

    const unsubscribeShape = useShapeEditorStore.subscribe(renderOverlayRef.current);
    const unsubscribeHistory = useHistoryStore.subscribe(renderOverlayRef.current);

    return () => {
      unsubscribeShape();
      unsubscribeHistory();
    };
  }, [
    ctxRef,
    isSnapEnabled,
    textEditorMode,
    tool,
    renderOverlayRef,
    activeSnapGuidesRef,
  ]);
};
