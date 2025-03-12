import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Toolbar } from '../Toolbar';
import { Stroke, StrokePoint } from '../../types';
import { useHistoryStore, useSettingsStore, useToolStore } from '../../store';
import { drawStrokes } from './utils';
import { useCanvasScaleSetup, useShortcuts } from './hooks';
    

export const Canvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const [points, setPoints] = useState<StrokePoint[]>([]);

  const { color, thickness } = useSettingsStore();
  const { tool } = useToolStore();
  const { present, addAction } = useHistoryStore();

  useShortcuts();
  useCanvasScaleSetup(canvasRef, ctxRef);

  const drawCanvas = useCallback((strokes: Stroke[]) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    drawStrokes(strokes, ctx);
  }, []);

  useEffect(() => {
    drawCanvas(present);
  }, [drawCanvas, present]);

  
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setPoints([{ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY, pressure: e.pressure }]);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.buttons !== 1) return;
    setPoints((prev) => {
      const newPoints = [...prev, { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY, pressure: e.pressure }];
      drawCanvas([...present, { points: newPoints, color, thickness, tool }]);
      return newPoints;
    });
  };

  const handlePointerUp = () => {
    addAction({ points, color, thickness, tool });
    setPoints([]);
  };

  return (
    <div>
      <Toolbar />
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
    </div>
  );
};
