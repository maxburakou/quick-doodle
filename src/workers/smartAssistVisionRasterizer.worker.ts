import type { Stroke } from "@/types";
import {
  buildVisionRasterStrokes,
  DEFAULT_VISION_RASTERIZE_OPTIONS,
  drawVisionRasterStrokes,
  type VisionRasterizeOptions,
} from "@/features/smartAssist/visionRasterizer";

interface RasterizeRequest {
  id: number;
  strokes: Stroke[];
  options: VisionRasterizeOptions;
}

interface RasterizeSuccess {
  id: number;
  ok: true;
  result: {
    imageBytes: Uint8Array;
    imageDataUrl: string | null;
    width: number;
    height: number;
  } | null;
}

interface RasterizeFailure {
  id: number;
  ok: false;
  error: string;
}

type RasterizeResponse = RasterizeSuccess | RasterizeFailure;

interface RasterizerWorkerScope {
  onmessage: ((event: MessageEvent<RasterizeRequest>) => void) | null;
  postMessage: (message: RasterizeResponse, transfer?: Transferable[]) => void;
}

const workerScope = self as unknown as RasterizerWorkerScope;

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => {
      reject(reader.error ?? new Error("vision-rasterizer-data-url-error"));
    };
    reader.onload = () => {
      resolve(typeof reader.result === "string" ? reader.result : "");
    };
    reader.readAsDataURL(blob);
  });

const rasterize = async (
  strokes: Stroke[],
  options: VisionRasterizeOptions = DEFAULT_VISION_RASTERIZE_OPTIONS
) => {
  const rasterStrokes = buildVisionRasterStrokes(strokes, options);
  if (!rasterStrokes) return null;

  const canvas = new OffscreenCanvas(rasterStrokes.width, rasterStrokes.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = options.backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawVisionRasterStrokes(rasterStrokes.strokes, ctx, options);

  const blob = await canvas.convertToBlob({ type: "image/png" });
  const [imageBuffer, imageDataUrl] = await Promise.all([
    blob.arrayBuffer(),
    options.includeDataUrl ? blobToDataUrl(blob) : Promise.resolve(null),
  ]);

  return {
    imageBytes: new Uint8Array(imageBuffer),
    imageDataUrl,
    width: rasterStrokes.width,
    height: rasterStrokes.height,
  };
};

workerScope.onmessage = (event: MessageEvent<RasterizeRequest>) => {
  const { id, strokes, options } = event.data;
  void rasterize(strokes, options).then(
    (result) => {
      const response: RasterizeResponse = { id, ok: true, result };
      if (result) {
        workerScope.postMessage(response, [
          result.imageBytes.buffer as ArrayBuffer,
        ]);
        return;
      }
      workerScope.postMessage(response);
    },
    (error) => {
      const response: RasterizeResponse = {
        id,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
      workerScope.postMessage(response);
    }
  );
};
