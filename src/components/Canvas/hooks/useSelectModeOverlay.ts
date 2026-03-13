import { useEffect } from "react";
import { useShapeEditorStore } from "@/store/useShapeEditorStore";
import { useHistoryStore } from "@/store/useHistoryStore";
import { useTextEditorStore } from "@/store/useTextEditorStore";
import { Tool, ShapeBounds } from "@/types";
import { SnapGuidesRenderData } from "../helpers/drawSnapMarker";
import {
  clearCanvas,
  drawSnapGuides,
  drawGroupSelectionOverlay,
  drawMarqueeOverlay,
  drawShapeEditorOverlay,
} from "../helpers";
import { drawStrokes, getTransformLayerFromSession } from "../utils";

interface UseSelectModeOverlayParams {
  ctxRef: React.MutableRefObject<CanvasRenderingContext2D | null>;
  tool: Tool;
  isSnapEnabled: boolean;
  marqueeBoundsRef: React.MutableRefObject<ShapeBounds | null>;
  activeSnapGuidesRef: React.MutableRefObject<SnapGuidesRenderData | null>;
  renderOverlayRef: React.MutableRefObject<() => void>;
}

export const useSelectModeOverlay = ({
  ctxRef,
  tool,
  isSnapEnabled,
  marqueeBoundsRef,
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
        drawShapeEditorOverlay(ctx, session.draftStroke);
      } else if (session?.type === "groupMove") {
        const draftStrokes = session.strokeIds
          .map((id) => session.draftStrokesById[id])
          .filter(Boolean);
        drawGroupSelectionOverlay(ctx, draftStrokes);
      } else if (selectedStrokes.length > 1) {
        drawGroupSelectionOverlay(ctx, selectedStrokes);
      } else if (primarySelectedStroke) {
        drawShapeEditorOverlay(ctx, primarySelectedStroke);
      }

      if (marqueeBoundsRef.current) {
        drawMarqueeOverlay(ctx, marqueeBoundsRef.current);
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
    marqueeBoundsRef,
    activeSnapGuidesRef,
  ]);
};
