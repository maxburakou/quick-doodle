export const clearCanvas = (
  ctx: CanvasRenderingContext2D | null
) => {
  if (!ctx) return;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
};