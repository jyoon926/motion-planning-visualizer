import { create } from 'zustand';
import type {
  AlgorithmStep,
  AlgorithmType,
  AlgorithmPhase,
  HoveredPoint,
  HoveredPolygon,
  Mode,
  Point,
  SpecialPoint,
  Parameters,
} from './types';

export interface ComparisonData {
  visibility: {
    pathLength: number;
  };
  voronoi: {
    pathLength: number;
  };
}

interface AppState {
  // Data
  polygons: Point[][];
  currentPoints: Point[];
  isComplete: boolean;
  startPoint: Point;
  goalPoint: Point;

  // Parameters
  params: Parameters;

  // UI/Interaction State
  mode: Mode;
  cursor: string;
  canvasSize: { width: number; height: number };
  mousePos: Point | null;

  // Hover/Drag State
  hoveredPoint: HoveredPoint | null;
  hoveredPolygon: HoveredPolygon | null;
  hoveredSpecialPoint: SpecialPoint;
  draggedPoint: HoveredPoint | null;
  draggedSpecialPoint: SpecialPoint;
  isDraggingPolygon: number | false;
  dragOffset: Point;
  hasDragged: boolean;

  // Context Tooltip
  canvasTooltip: string | null;

  // Algorithm/Timeline State
  algorithm: AlgorithmType;
  timeline: AlgorithmStep[];
  phases: AlgorithmPhase[];
  currentStep: number;
  isPlaying: boolean;
  fps: number;

  // Timeline UI
  hoveredPhaseId: string | null;
  activePhaseId: string | null;

  // Other
  compareData: ComparisonData;
  isAboutDialogOpen: boolean;
  finalVisStep: AlgorithmStep | null;
  finalVoronoiStep: AlgorithmStep | null;

  // Actions
  setPolygons: (polygons: Point[][]) => void;
  setCurrentPoints: (points: Point[]) => void;
  setIsComplete: (isComplete: boolean) => void;
  setStartPoint: (point: Point) => void;
  setGoalPoint: (point: Point) => void;
  setParams: (params: Partial<Parameters>) => void;

  setMode: (mode: Mode) => void;
  setCursor: (cursor: string) => void;
  setCanvasSize: (size: { width: number; height: number }) => void;
  setMousePos: (pos: Point | null) => void;

  setHoveredPoint: (point: HoveredPoint | null) => void;
  setHoveredPolygon: (poly: HoveredPolygon | null) => void;
  setHoveredSpecialPoint: (point: SpecialPoint) => void;
  setDraggedPoint: (point: HoveredPoint | null) => void;
  setDraggedSpecialPoint: (point: SpecialPoint) => void;
  setIsDraggingPolygon: (idx: number | false) => void;
  setDragOffset: (offset: Point) => void;
  setHasDragged: (hasDragged: boolean) => void;
  setCanvasTooltip: (text: string | null) => void;

  setAlgorithm: (algo: AlgorithmType) => void;
  setTimelineData: (steps: AlgorithmStep[], phases: AlgorithmPhase[]) => void;
  setCurrentStep: (step: number | ((prev: number) => number)) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setFps: (fps: number) => void;
  setHoveredPhaseId: (id: string | null) => void;

  setCompareData: (data: Partial<ComparisonData>) => void;
  setIsAboutDialogOpen: (isOpen: boolean) => void;
  setFinalVisStep: (step: AlgorithmStep | null) => void;
  setFinalVoronoiStep: (step: AlgorithmStep | null) => void;
}

export const useStore = create<AppState>((set) => ({
  // Initial State
  polygons: [],
  currentPoints: [],
  isComplete: true,
  startPoint: { x: 100, y: 200 },
  goalPoint: { x: 500, y: 200 },

  params: {
    voronoiSampleDist: 20,
  },

  mode: 'edit',
  cursor: 'crosshair',
  canvasSize: { width: 0, height: 0 },
  mousePos: null,

  hoveredPoint: null,
  hoveredPolygon: null,
  hoveredSpecialPoint: null,
  draggedPoint: null,
  draggedSpecialPoint: null,
  isDraggingPolygon: false,
  dragOffset: { x: 0, y: 0 },
  hasDragged: false,
  canvasTooltip: null,

  algorithm: 'visibility',
  timeline: [],
  phases: [],
  currentStep: -1,
  isPlaying: false,
  fps: 5,

  hoveredPhaseId: null,
  activePhaseId: null,

  compareData: {
    visibility: { pathLength: 0 },
    voronoi: { pathLength: 0 },
  },
  isAboutDialogOpen: true,
  finalVisStep: null,
  finalVoronoiStep: null,

  // Setters
  setPolygons: (polygons) => set({ polygons }),
  setCurrentPoints: (currentPoints) => set({ currentPoints }),
  setIsComplete: (isComplete) => set({ isComplete }),
  setStartPoint: (startPoint) => set({ startPoint }),
  setGoalPoint: (goalPoint) => set({ goalPoint }),

  setParams: (newParams) => set((state) => ({ params: { ...state.params, ...newParams } })),

  setMode: (mode) => set({ mode }),
  setCursor: (cursor) => set({ cursor }),
  setCanvasSize: (canvasSize) => set({ canvasSize }),
  setMousePos: (mousePos) => set({ mousePos }),

  setHoveredPoint: (hoveredPoint) => set({ hoveredPoint }),
  setHoveredPolygon: (hoveredPolygon) => set({ hoveredPolygon }),
  setHoveredSpecialPoint: (hoveredSpecialPoint) => set({ hoveredSpecialPoint }),
  setDraggedPoint: (draggedPoint) => set({ draggedPoint }),
  setDraggedSpecialPoint: (draggedSpecialPoint) => set({ draggedSpecialPoint }),
  setIsDraggingPolygon: (isDraggingPolygon) => set({ isDraggingPolygon }),
  setDragOffset: (dragOffset) => set({ dragOffset }),
  setHasDragged: (hasDragged) => set({ hasDragged }),
  setCanvasTooltip: (canvasTooltip) => set({ canvasTooltip }),

  setAlgorithm: (algorithm) => set({ algorithm }),

  setTimelineData: (timeline, phases) => set({ timeline, phases }),

  setCurrentStep: (updater) =>
    set((state) => {
      const nextStep = typeof updater === 'function' ? updater(state.currentStep) : updater;
      // Determine active phase based on step
      const activePhase = state.phases.find((p) => nextStep >= p.startStepIndex && nextStep <= p.endStepIndex);
      return {
        currentStep: nextStep,
        activePhaseId: activePhase ? activePhase.id : state.activePhaseId,
      };
    }),

  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setFps: (fps) => set({ fps }),
  setHoveredPhaseId: (hoveredPhaseId) => set({ hoveredPhaseId }),

  setCompareData: (data) =>
    set((state) => ({
      compareData: {
        visibility: { ...state.compareData.visibility, ...data.visibility },
        voronoi: { ...state.compareData.voronoi, ...data.voronoi },
      },
    })),
  setIsAboutDialogOpen: (isAboutDialogOpen) => set({ isAboutDialogOpen }),
  setFinalVisStep: (finalVisStep) => set({ finalVisStep }),
  setFinalVoronoiStep: (finalVoronoiStep) => set({ finalVoronoiStep }),
}));
