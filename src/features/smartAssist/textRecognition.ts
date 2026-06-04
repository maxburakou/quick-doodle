import TextRecognitionWorker from "./textRecognition.worker?worker";
import { Stroke } from "@/types";
import { SMART_ASSIST_CONFIG } from "./config";
import type {
  TextRecognitionCandidate,
  TextRecognitionResult,
} from "./textRecognition.worker";

export type { TextRecognitionCandidate, TextRecognitionResult };

interface WorkerResponse {
  jobId: number;
  result?: TextRecognitionResult;
  error?: string;
}

interface PendingRecognition {
  reject: (error: Error) => void;
  resolve: (result: TextRecognitionResult) => void;
  timeoutId: ReturnType<typeof setTimeout>;
}

let workerInstance: Worker | null = null;
let currentJobId = 0;
const pendingRecognitions = new Map<number, PendingRecognition>();

const clearPendingRecognition = (jobId: number) => {
  const pending = pendingRecognitions.get(jobId);
  if (!pending) return null;

  clearTimeout(pending.timeoutId);
  pendingRecognitions.delete(jobId);
  return pending;
};

const rejectAllPendingRecognitions = (error: Error) => {
  pendingRecognitions.forEach((pending, jobId) => {
    clearTimeout(pending.timeoutId);
    pending.reject(error);
    pendingRecognitions.delete(jobId);
  });
};

const getTextRecognitionWorker = () => {
  if (!workerInstance) {
    workerInstance = new TextRecognitionWorker({ name: "text-recognition" });
    workerInstance.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const { jobId, result, error } = event.data;
      const pending = clearPendingRecognition(jobId);
      if (!pending) return;

      if (error) {
        pending.reject(new Error(error));
        return;
      }
      if (!result) {
        pending.reject(new Error("text-recognition-empty-result"));
        return;
      }

      pending.resolve(result);
    };
    workerInstance.onerror = (event) => {
      rejectAllPendingRecognitions(
        new Error(event.message || "text-recognition-worker-error")
      );
      workerInstance?.terminate();
      workerInstance = null;
    };
  }

  return workerInstance;
};

export const recognizeOnlineHandwriting = (
  strokes: Stroke[]
): Promise<TextRecognitionResult> =>
  new Promise((resolve, reject) => {
    const worker = getTextRecognitionWorker();
    const jobId = ++currentJobId;
    const timeoutId = setTimeout(() => {
      const pending = clearPendingRecognition(jobId);
      if (!pending) return;
      pending.reject(new Error("text-recognition-timeout"));
    }, SMART_ASSIST_CONFIG.text.recognitionTimeoutMs);

    pendingRecognitions.set(jobId, { reject, resolve, timeoutId });
    worker.postMessage({ jobId, strokes });
  });

export const disposeTextRecognitionWorker = () => {
  if (!workerInstance) return;

  workerInstance.terminate();
  workerInstance = null;
  rejectAllPendingRecognitions(new Error("text-recognition-worker-disposed"));
};
