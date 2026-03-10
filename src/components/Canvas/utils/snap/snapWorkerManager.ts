import SnapWorker from "@/workers/snap.worker?worker";
import { SceneSnapContext, CanvasBounds, SceneSnapContextCache } from "./snapContext";
import type { MutableRefObject } from "react";
import { Stroke } from "@/types";

let workerInstance: Worker | null = null;
let currentJobId = 0;
const pendingJobs = new Map<number, { resolve: (val: SceneSnapContext) => void, reject: (err: unknown) => void }>();

export const getSnapWorker = () => {
  if (!workerInstance) {
    workerInstance = new SnapWorker();
    workerInstance.onmessage = (e) => {
      const { jobId, context, error } = e.data;
      const job = pendingJobs.get(jobId);
      if (job) {
        pendingJobs.delete(jobId);
        if (error) job.reject(new Error(error));
        else job.resolve(context);
      }
    };
  }
  return workerInstance;
};

export const requestSceneSnapContext = (
  present: Stroke[],
  excludedIds: string[],
  canvasBounds: CanvasBounds
): Promise<SceneSnapContext> => {
  return new Promise((resolve, reject) => {
    const worker = getSnapWorker();
    const jobId = ++currentJobId;
    pendingJobs.set(jobId, { resolve, reject });
    worker.postMessage({ jobId, present, excludedIds, canvasBounds });
  });
};

const toExcludedIdsKey = (excludedIds: string[]) =>
  excludedIds.length <= 1
    ? (excludedIds[0] ?? "")
    : [...excludedIds].sort().join("|");

export const getAsyncCachedSceneSnapContext = async (
  cacheRef: MutableRefObject<SceneSnapContextCache | null>,
  present: Stroke[],
  excludedIds: string[],
  canvasBounds: CanvasBounds
): Promise<SceneSnapContext> => {
  const excludedIdsKey = toExcludedIdsKey(excludedIds);
  const cached = cacheRef.current;

  if (
    cached &&
    cached.presentRef === present &&
    cached.excludedIdsKey === excludedIdsKey &&
    cached.canvasWidth === canvasBounds.width &&
    cached.canvasHeight === canvasBounds.height
  ) {
    return cached.context;
  }

  const context = await requestSceneSnapContext(present, excludedIds, canvasBounds);
  cacheRef.current = {
    presentRef: present,
    excludedIdsKey,
    canvasWidth: canvasBounds.width,
    canvasHeight: canvasBounds.height,
    context,
  };

  return context;
};
