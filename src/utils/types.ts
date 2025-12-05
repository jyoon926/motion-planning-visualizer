export interface Point {
  x: number;
  y: number;
}

export interface Parameters {
  voronoiSampleDist: number;
}

// Visual metadata for a single step
export interface AlgorithmStep {
  phaseId: string;
  message: string;

  // State Snapshots
  vertices: Point[];
  edges: [Point, Point][];
  path: Point[];

  // Active/Highlight elements
  activeEdge?: [Point, Point];
  activeNode?: Point;
  scanLine?: [Point, Point]; // e.g. a ray being cast
  activeState?: 'valid' | 'invalid' | 'checking' | 'neutral';

  // Voronoi-specific visualization
  triangles?: Array<[Point, Point, Point]>;
  activeTriangles?: Array<[Point, Point, Point]>;
  circumcenters?: Point[];
  activeCircumcenter?: Point;
  circumcircles?: Array<{ center: Point; radius: number }>;
  newTriangles?: Array<[Point, Point, Point]>;
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
export type AlgorithmType = 'visibility' | 'voronoi' | 'compare';

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
