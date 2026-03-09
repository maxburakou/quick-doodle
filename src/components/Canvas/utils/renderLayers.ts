import { ShapeEditorSession, Stroke, Tool } from "@/types";
import { TextEditorMode } from "@/store/useTextEditorStore/types";

interface TransformLayer {
  activeStrokeIds: string[];
  activeStrokes: Stroke[];
  isTransforming: boolean;
}

interface RenderLayersParams {
  present: Stroke[];
  activeStrokeIds: string[];
  activeStrokes?: Stroke[];
  textEditorMode: TextEditorMode;
  editingStrokeId: string | null;
}

interface RenderLayers {
  staticStrokes: Stroke[];
  activeStrokes: Stroke[];
  isTransforming: boolean;
}

const filterOutEditingTextStroke = (
  strokes: Stroke[],
  textEditorMode: TextEditorMode,
  editingStrokeId: string | null
) => {
  if (textEditorMode !== "edit" || !editingStrokeId) {
    return strokes;
  }

  return strokes.filter(
    (stroke) => !(stroke.id === editingStrokeId && stroke.tool === Tool.Text)
  );
};

export const getTransformLayerFromSession = (
  session: ShapeEditorSession | null
): TransformLayer => {
  if (!session) {
    return {
      activeStrokeIds: [],
      activeStrokes: [],
      isTransforming: false,
    };
  }

  if (session.type === "single") {
    return {
      activeStrokeIds: [session.strokeId],
      activeStrokes: [session.draftStroke],
      isTransforming: true,
    };
  }

  const activeStrokes = session.strokeIds
    .map((id) => session.draftStrokesById[id])
    .filter((stroke): stroke is Stroke => Boolean(stroke));

  return {
    activeStrokeIds: session.strokeIds,
    activeStrokes,
    isTransforming: true,
  };
};

export const getRenderLayers = ({
  present,
  activeStrokeIds,
  activeStrokes = [],
  textEditorMode,
  editingStrokeId,
}: RenderLayersParams): RenderLayers => {
  const activeIdSet = new Set(activeStrokeIds);
  const baseStaticStrokes =
    activeIdSet.size === 0
      ? present
      : present.filter((stroke) => !activeIdSet.has(stroke.id));

  return {
    staticStrokes: filterOutEditingTextStroke(
      baseStaticStrokes,
      textEditorMode,
      editingStrokeId
    ),
    activeStrokes,
    isTransforming: activeIdSet.size > 0,
  };
};
