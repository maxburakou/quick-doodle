import SnapWorker from "@/workers/snap.worker?worker";
import { SceneSnapContext, CanvasBounds, SceneSnapContextCache } from "./snapContext";
import type { MutableRefObject } from "react";
import { Stroke } from "@/types";

let workerInstance: Worker | null = null;
let currentJobId = 0;
let presentRefId = 0;
const JOB_TIMEOUT_MS = 12_000;

interface PendingJob {
  resolve: (val: SceneSnapContext) => void;
  reject: (err: unknown) => void;
  timeoutId: ReturnType<typeof setTimeout>;
}

const pendingJobs = new Map<number, PendingJob>();
const inFlightByKey = new Map<string, Promise<SceneSnapContext>>();
const presentRefIds = new WeakMap<Stroke[], number>();
const latestRequestByCacheRef = new WeakMap<
  MutableRefObject<SceneSnapContextCache | null>,
  number
>();

const clearPendingJob = (jobId: number) => {
  const pending = pendingJobs.get(jobId);
  if (!pending) return null;
  clearTimeout(pending.timeoutId);
  pendingJobs.delete(jobId);
  return pending;
};

const rejectAllPendingJobs = (reason: unknown) => {
  pendingJobs.forEach((pending, jobId) => {
    clearTimeout(pending.timeoutId);
    pending.reject(reason);
    pendingJobs.delete(jobId);
  });
};

const getPresentRefId = (present: Stroke[]) => {
  const existing = presentRefIds.get(present);
  if (typeof existing === "number") {
    return existing;
  }
  const nextId = ++presentRefId;
  presentRefIds.set(present, nextId);
  return nextId;
};

export const getSnapWorker = () => {
  if (!workerInstance) {
    workerInstance = new SnapWorker();
    workerInstance.onmessage = (e) => {
      const { jobId, context, error } = e.data;
      const job = clearPendingJob(jobId);
      if (job) {
        if (error) job.reject(new Error(error));
        else job.resolve(context);
      }
    };
    workerInstance.onerror = (event) => {
      rejectAllPendingJobs(new Error(event.message || "Snap worker failed"));
    };
  }
  return workerInstance;
};

export const requestSceneSnapContext = (
  present: Stroke[],
  excludedIds: string[],
  canvasBounds: CanvasBounds,
  requestKey?: string
): Promise<SceneSnapContext> => {
  if (requestKey) {
    const inFlight = inFlightByKey.get(requestKey);
    if (inFlight) return inFlight;
  }

  const promise = new Promise<SceneSnapContext>((resolve, reject) => {
    const worker = getSnapWorker();
    const jobId = ++currentJobId;
    const timeoutId = setTimeout(() => {
      const pending = clearPendingJob(jobId);
      if (!pending) return;
      pending.reject(new Error("Snap worker request timed out"));
    }, JOB_TIMEOUT_MS);

    pendingJobs.set(jobId, { resolve, reject, timeoutId });
    worker.postMessage({ jobId, present, excludedIds, canvasBounds });
  });

  if (requestKey) {
    inFlightByKey.set(requestKey, promise);
    promise.finally(() => {
      const activePromise = inFlightByKey.get(requestKey);
      if (activePromise === promise) {
        inFlightByKey.delete(requestKey);
      }
    });
  }

  return promise;
};

const toRequestKey = (
  present: Stroke[],
  excludedIdsKey: string,
  canvasBounds: CanvasBounds
) =>
  `${getPresentRefId(present)}|${excludedIdsKey}|${canvasBounds.width}|${canvasBounds.height}`;

const getNextRequestVersion = (
  cacheRef: MutableRefObject<SceneSnapContextCache | null>
) => {
  const next = (latestRequestByCacheRef.get(cacheRef) ?? 0) + 1;
  latestRequestByCacheRef.set(cacheRef, next);
  return next;
};

const isLatestRequestVersion = (
  cacheRef: MutableRefObject<SceneSnapContextCache | null>,
  requestVersion: number
) => latestRequestByCacheRef.get(cacheRef) === requestVersion;

export const disposeSnapWorker = () => {
  if (!workerInstance) return;
  workerInstance.terminate();
  workerInstance = null;
  inFlightByKey.clear();
  rejectAllPendingJobs(new Error("Snap worker disposed"));
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

  const requestVersion = getNextRequestVersion(cacheRef);
  const requestKey = toRequestKey(present, excludedIdsKey, canvasBounds);
  const context = await requestSceneSnapContext(
    present,
    excludedIds,
    canvasBounds,
    requestKey
  );

  if (!isLatestRequestVersion(cacheRef, requestVersion)) {
    return cacheRef.current?.context ?? context;
  }

  cacheRef.current = {
    presentRef: present,
    excludedIdsKey,
    canvasWidth: canvasBounds.width,
    canvasHeight: canvasBounds.height,
    context,
  };

  return context;
};
