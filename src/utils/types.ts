// utils/types.ts
export interface Point {
  x: number;
  y: number;
}

export interface Parameters {
  obstacleMargin: number; // For inflating obstacles
  voronoiSampleDist: number;
}

// Visual metadata for a single step
export interface AlgorithmStep {
  phaseId: string; // Links step to a high-level phase
  message: string;
  codeLine?: number; // For highlighting pseudocode

  // State Snapshots
  vertices: Point[];
  edges: [Point, Point][];
  path: Point[];

  // Active/Highlight elements (The "doing" part)
  activeEdge?: [Point, Point];
  activeNode?: Point;
  scanLine?: [Point, Point]; // e.g. a ray being cast
  activeState?: 'valid' | 'invalid' | 'checking' | 'neutral';
}

export interface AlgorithmPhase {
  id: string;
  name: string;
  description: string;
  pseudocode: string;
  complexity: string;
  startStepIndex: number;
  endStepIndex: number;
}

export interface HoveredPoint {
  polygonIdx: number;
  pointIdx: number;
}

export interface HoveredPolygon {
  polygonIdx: number;
  type: 'body';
}

export type Mode = 'edit' | 'delete';
export type SpecialPoint = 'start' | 'goal' | null;
export type AlgorithmType = 'visibility' | 'voronoi';

export interface AlgorithmOutput {
  steps: AlgorithmStep[];
  phases: AlgorithmPhase[];
}

export interface AlgorithmInfo {
  name: string;
  description: string;
  algorithm: (
    start: Point,
    goal: Point,
    obstacles: Point[][],
    canvasSize: { width: number; height: number },
    params: Parameters
  ) => AlgorithmOutput;
}
