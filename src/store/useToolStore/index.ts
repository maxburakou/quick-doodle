import { create } from "zustand";
import { Tool } from "@/types";
import { ToolState } from "./types";

export const useToolStore = create<ToolState>((set) => ({
  tool: Tool.Pen,
  setTool: (tool) => set({ tool }),
}));
export const useTool = () => useToolStore((state) => state.tool);
export const useSetTool = () => useToolStore((state) => state.setTool);
