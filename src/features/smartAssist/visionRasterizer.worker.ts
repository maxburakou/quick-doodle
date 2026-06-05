import getStroke from "perfect-freehand";
import { PEN_STROKE_OPTIONS } from "@/components/Canvas/utils/penStrokeOptions";
import type { Stroke, StrokePoint } from "@/types";
import {
  buildVisionRasterStrokes,
  DEFAULT_VISION_RASTERIZE_OPTIONS,
  type VisionRasterizeOptions,
} from "./visionRasterizer";

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
    imageDataUrl: null;
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

const drawPenStroke = (
  ctx: OffscreenCanvasRenderingContext2D,
  points: StrokePoint[],
  color: string,
  thickness: number
) => {
  const strokePath = getStroke(
    points.map(({ x, y }) => [x, y]),
    { ...PEN_STROKE_OPTIONS, size: thickness }
  );
  if (strokePath.length === 0) return;

  ctx.beginPath();
  ctx.moveTo(strokePath[0][0], strokePath[0][1]);
  for (let index = 1; index < strokePath.length - 1; index += 1) {
    const [x0, y0] = strokePath[index];
    const [x1, y1] = strokePath[index + 1];
    ctx.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  }

  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
};

const rasterize = async (
  strokes: Stroke[],
  options: VisionRasterizeOptions = DEFAULT_VISION_RASTERIZE_OPTIONS
) => {
  const rasterStrokes = buildVisionRasterStrokes(strokes, {
    ...options,
    includeDataUrl: false,
  });
  if (!rasterStrokes) return null;

  const canvas = new OffscreenCanvas(rasterStrokes.width, rasterStrokes.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = options.backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  rasterStrokes.strokes.forEach((stroke) => {
    drawPenStroke(ctx, stroke.points, stroke.color, stroke.thickness);
  });

  const blob = await canvas.convertToBlob({ type: "image/png" });
  return {
    imageBytes: new Uint8Array(await blob.arrayBuffer()),
    imageDataUrl: null,
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
