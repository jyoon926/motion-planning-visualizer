// algorithms/visibilityGraph.ts
import { getKeyString } from '../utils/common';
import { expandPolygon } from '../utils/geometry';
import type { AlgorithmOutput, AlgorithmPhase, AlgorithmStep, Parameters, Point } from '../utils/types';
import { runAStar } from './astar';

interface StarPoint {
  pnt: Point;
  f: number;
  g: number;
  h: number;
  parent: Point;
}

export function computeVisibilityGraph(
  start: Point,
  goal: Point,
  rawPolygons: Point[][],
  _: { width: number; height: number },
  params: Parameters
): AlgorithmOutput {
  const steps: AlgorithmStep[] = [];
  const phases: AlgorithmPhase[] = []; // State accumulators

  let currentVertices: Point[] = [];
  let currentEdges: [Point, Point][] = [];
  let currentPath: Point[] = []; // Helper to push step

  const addStep = (phaseId: string, message: string, extras: Partial<AlgorithmStep> = {}) => {
    steps.push({
      phaseId,
      message,
      vertices: [...currentVertices], // Capture the current state of vertices
      edges: [...currentEdges],
      path: [...currentPath],
      ...extras,
    });
  };

  // --- PHASE 1: PRE-PROCESSING (Build Vertices Step-by-Step) ---

  const phase1Id = 'init';
  const startIdx1 = steps.length; // Inflate polygons

  const obstacles = rawPolygons.map((p) => expandPolygon(p, params.obstacleMargin));

  // 1. Add Start and Goal Points (Consolidated Step)
  currentVertices.push(start, goal);
  addStep(phase1Id, 'Added Start and Goal points to the set of vertices.', {
    activeNode: start, // Highlight the start point
    codeLine: 2, // Corresponds to `V = {start, goal} + ...`
  });

  // 2. Add all Obstacle Vertices (Consolidated Step)
  const allObstacleVertices = obstacles.flat();
  currentVertices.push(...allObstacleVertices); // Add all at once

  addStep(
    phase1Id,
    `Added ${allObstacleVertices.length} obstacle corner vertices. Total vertices: ${currentVertices.length}.`,
    {
      codeLine: 2, // Corresponds to `V = {start, goal} + Vertices(...)`
      activeState: 'neutral',
    }
  );

  // 3. Initialize graph structure AFTER all vertices are added
  const vgraph: Map<string, Point[]> = new Map();
  currentVertices.forEach((v) => vgraph.set(getKeyString(v), []));

  phases.push({
    id: phase1Id,
    name: 'Initialization',
    description:
      'We begin by defining the nodes (vertices) of our graph. These include the Start point, the Goal point, and all corner vertices of the obstacles. If an obstacle margin is defined, all obstacle polygons are first inflated (enlarged) to ensure a safe distance is maintained from the path to the physical obstacle, treating the moving agent as a point.',
    pseudocode: `// 1. Inflate Polygons (if margin > 0)
Expanded_Obstacles = Expand(Raw_Obstacles, Margin)

// 2. Define Vertices
V = {start, goal} + Vertices(Expanded_Obstacles)

// 3. Initialize Graph
G = (V, E) where E = {}`,
    complexity: 'O(V + M)', // V for vertices, M for margin calculation on edges
    startStepIndex: startIdx1,
    endStepIndex: steps.length - 1,
  }); // --- PHASE 2: VISIBILITY CHECK ---

  // ---------------------------------------------------------------- //

  const phase2Id = 'visibility';
  const startIdx2 = steps.length;

  const ccw = (A: Point, B: Point, C: Point): boolean => (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);
  const segmentsIntersect = (A: Point, B: Point, C: Point, D: Point): boolean =>
    ccw(A, C, D) !== ccw(B, C, D) && ccw(A, B, C) !== ccw(A, B, D);

  const isVisible = (p1: Point, p2: Point): boolean => {
    for (const polygon of obstacles) {
      let selfIntersectionCounter = 0;
      for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i];
        const b = polygon[(i + 1) % polygon.length]; // Skip endpoints

        if (
          (a.x === p1.x && a.y === p1.y) ||
          (b.x === p1.x && b.y === p1.y) ||
          (a.x === p2.x && a.y === p2.y) ||
          (b.x === p2.x && b.y === p2.y)
        ) {
          selfIntersectionCounter++;
          continue;
        }
        if (segmentsIntersect(p1, p2, a, b)) return false;
      } // Simple interior check approximation
      if (selfIntersectionCounter > 3) return false;
    }
    return true;
  }; // Iterate all pairs

  for (let i = 0; i < currentVertices.length; i++) {
    for (let j = i + 1; j < currentVertices.length; j++) {
      const v1 = currentVertices[i];
      const v2 = currentVertices[j]; // Visualization: Showing the check

      addStep(
        phase2Id,
        `Checking visibility between (${Math.round(v1.x)}, ${Math.round(v1.y)}) and (${Math.round(v2.x)}, ${Math.round(v2.y)})`,
        {
          scanLine: [v1, v2],
          activeState: 'checking',
          codeLine: 2,
        }
      );

      if (isVisible(v1, v2)) {
        currentEdges.push([v1, v2]);
        vgraph.get(getKeyString(v1))?.push(v2);
        vgraph.get(getKeyString(v2))?.push(v1);

        addStep(phase2Id, 'Line of sight is clear. Edge added.', {
          activeEdge: [v1, v2],
          activeState: 'valid',
          codeLine: 3,
        });
      } else {
        // Optional: Visualizing a blocked line briefly
        addStep(phase2Id, 'Line of sight blocked by obstacle.', {
          scanLine: [v1, v2],
          activeState: 'invalid',
          codeLine: 2,
        });
      }
    }
  }

  phases.push({
    id: phase2Id,
    name: 'Building Visibility Graph',
    description:
      'We construct the edges of the graph by checking the line of sight (LOS) between every pair of vertices. An edge exists if and only if the straight line segment between the two vertices does not intersect any obstacle. The intersection check uses the Counter-Clockwise (CCW) orientation test to determine if two line segments cross.',
    pseudocode: `For each pair (u, v) in V:
  If LOS(u, v) is not Blocked by any Obstacle Edge:
    Add edge (u, v) to G

// LOS Check Detail:
function SegmentsIntersect(A, B, C, D):
  Return CCW(A, C, D) != CCW(B, C, D) && CCW(A, B, C) != CCW(A, B, D)`,
    complexity: 'O(V² * E_obs)', // V vertices, E_obs obstacle edges. V² pairs * E_obs checks per pair.
    startStepIndex: startIdx2,
    endStepIndex: steps.length - 1,
  }); // --- PHASE 3: PATHFINDING (A*) ---

  // ---------------------------------------------------------------- //

  const phase3Id = 'astar';
  const startIdx3 = steps.length;

  const pathResult = runAStar(start, goal, vgraph, (msg, meta) => {
    addStep(phase3Id, msg, meta);
  });

  if (pathResult.length > 0) {
    currentPath = pathResult;
    addStep(phase3Id, 'Optimal path found!', { activeState: 'valid' });
  } else {
    addStep(phase3Id, 'No path found.', { activeState: 'invalid' });
  }

  phases.push({
    id: phase3Id,
    name: 'A* Search',
    description:
      'With the complete visibility graph built, the A* search algorithm is used to find the shortest path from the Start node to the Goal node. A* minimizes the total estimated cost f(n) = g(n) + h(n), where g(n) is the actual cost from the start to node n, and h(n) is the Euclidean distance (straight-line distance) from node n to the goal, serving as an admissible heuristic.',
    pseudocode: `OpenSet = {start}
While OpenSet not empty:
  Current = Node with lowest F-score (g + h)
  If Current == Goal: Reconstruct Path
  For each neighbor:
    Calculate tentative g-score
    If tentative g < g[neighbor]:
      Update scores and set parent`,
    complexity: 'O(E log V)', // E edges, V vertices
    startStepIndex: startIdx3,
    endStepIndex: steps.length - 1,
  });

  return { steps, phases };
}
