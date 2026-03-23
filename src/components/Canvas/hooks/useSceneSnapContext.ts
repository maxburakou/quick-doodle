import { useCallback, useEffect, useMemo, useRef } from "react";
import { useHistoryStore } from "@/store/useHistoryStore";
import type {
  SceneSnapContext,
  SceneSnapContextCache,
} from "../utils/snap/snapContext";
import { getAsyncCachedSceneSnapContext } from "../utils/snap/snapWorkerManager";
import { getCanvasBoundsFromCtx } from "../utils/getCanvasBounds";

interface UseSceneSnapContextParams {
  ctxRef: React.MutableRefObject<CanvasRenderingContext2D | null>;
  isSnapEnabled: boolean;
  autoPrecomputeExcludedIds?: string[];
}

const EMPTY_CONTEXT: SceneSnapContext = {
  anchors: [],
  segments: [],
  axisCandidates: [],
};

export const useSceneSnapContext = ({
  ctxRef,
  isSnapEnabled,
  autoPrecomputeExcludedIds,
}: UseSceneSnapContextParams) => {
  const cacheRef = useRef<SceneSnapContextCache | null>(null);
  const fallbackContext = useMemo(() => EMPTY_CONTEXT, []);

  const getSceneSnapContext = useCallback(
    () => cacheRef.current?.context ?? fallbackContext,
    [fallbackContext]
  );

  const clearSceneSnapCache = useCallback(() => {
    cacheRef.current = null;
  }, []);

  const precomputeSceneSnapContext = useCallback(
    (excludedIds: string[]) => {
      if (!isSnapEnabled) return;

      const compute = async () => {
        try {
          const { present } = useHistoryStore.getState();
          const canvasBounds = getCanvasBoundsFromCtx(ctxRef);
          await getAsyncCachedSceneSnapContext(
            cacheRef,
            present,
            excludedIds,
            canvasBounds
          );
        } catch (error) {
          console.error("Failed to precompute snap context", error);
        }
      };

      void compute();
    },
    [ctxRef, isSnapEnabled]
  );

  useEffect(() => {
    if (!isSnapEnabled || !autoPrecomputeExcludedIds) return;

    const compute = () => precomputeSceneSnapContext(autoPrecomputeExcludedIds);
    compute();
    return useHistoryStore.subscribe(compute);
  }, [autoPrecomputeExcludedIds, isSnapEnabled, precomputeSceneSnapContext]);

  return {
    getSceneSnapContext,
    clearSceneSnapCache,
    precomputeSceneSnapContext,
  };
};
