import { MutableRefObject, useEffect, useMemo } from "react";
import { useSmartAssistStore } from "@/features/smartAssist";
import {
  drawBatchLoadingFrame,
  drawTransitionFrame,
} from "../transitionAnimation";

export const useTransitionCanvasAnimation = (
  ctxRef: MutableRefObject<CanvasRenderingContext2D | null>
) => {
  const batch = useSmartAssistStore((state) => state.batch);
  const transition = useSmartAssistStore((state) => state.transition);
  const reduceMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  useEffect(() => {
    if (!transition && !batch) {
      const ctx = ctxRef.current;
      ctx?.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      return;
    }

    let frameId: number | null = null;

    const renderFrame = () => {
      const ctx = ctxRef.current;
      if (!ctx) return;

      if (transition) {
        drawTransitionFrame(ctx, transition, Date.now(), reduceMotion);

        if (
          !reduceMotion &&
          Date.now() - transition.startedAt < transition.durationMs
        ) {
          frameId = window.requestAnimationFrame(renderFrame);
        }

        return;
      }

      if (batch) {
        drawBatchLoadingFrame(ctx, batch, Date.now(), reduceMotion);

        if (!reduceMotion) {
          frameId = window.requestAnimationFrame(renderFrame);
        }
      }
    };

    renderFrame();

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [batch, ctxRef, reduceMotion, transition]);
};
