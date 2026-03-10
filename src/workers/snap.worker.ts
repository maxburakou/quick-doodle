import { Stroke } from "@/types";
import { buildSceneSnapContext, CanvasBounds } from "@/components/Canvas/utils/snap/snapContext";

export interface SnapWorkerRequest {
  jobId: number;
  present: Stroke[];
  excludedIds: string[];
  canvasBounds: CanvasBounds;
}

self.onmessage = (e: MessageEvent<SnapWorkerRequest>) => {
  const { jobId, present, excludedIds, canvasBounds } = e.data;
  try {
    const context = buildSceneSnapContext(present, excludedIds, canvasBounds);
    self.postMessage({ jobId, context });
  } catch (err) {
    self.postMessage({ jobId, error: String(err) });
  }
};

export {};
