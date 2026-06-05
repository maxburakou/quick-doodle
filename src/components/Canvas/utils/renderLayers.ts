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
  transitionStrokeIds?: string[];
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
  transitionStrokeIds = [],
  activeStrokes = [],
  textEditorMode,
  editingStrokeId,
}: RenderLayersParams): RenderLayers => {
  const activeIdSet = new Set(activeStrokeIds);
  const transitionIdSet = new Set(transitionStrokeIds);
  const hasLayeredStrokes = activeIdSet.size > 0 || transitionIdSet.size > 0;
  const baseStaticStrokes = hasLayeredStrokes
    ? present.filter(
        (stroke) =>
          !activeIdSet.has(stroke.id) && !transitionIdSet.has(stroke.id)
      )
    : present;

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
