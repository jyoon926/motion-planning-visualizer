import { getKeyString } from '../utils/common';
import type { AlgorithmOutput, AlgorithmPhase, AlgorithmStep, Point } from '../utils/types';
import { runAStar } from './astar';

export function computeVisibilityGraph(
  start: Point,
  goal: Point,
  polygons: Point[][],
  canvasSize: { width: number; height: number }
): AlgorithmOutput {
  console.log(canvasSize);
  const steps: AlgorithmStep[] = [];
  const phases: AlgorithmPhase[] = [];
  const currentVertices: Point[] = [];
  const currentEdges: [Point, Point][] = [];
  let currentPath: Point[] = [];

  const addStep = (phaseId: string, message: string, extras: Partial<AlgorithmStep> = {}) => {
    steps.push({
      phaseId,
      message,
      vertices: [...currentVertices],
      edges: [...currentEdges],
      path: [...currentPath],
      ...extras,
    });
  };

  // --- PHASE 1: INIT ---
  const phase1Id = 'init';
  const startIdx1 = steps.length;

  // 1. Add Start and Goal Points
  currentVertices.push(start, goal);
  addStep(phase1Id, 'Added Start and Goal points to the set of vertices.');

  // 2. Add Obstacle Vertices
  const allObstacleVertices = polygons.flat();
  currentVertices.push(...allObstacleVertices);

  addStep(
    phase1Id,
    `Added ${allObstacleVertices.length} obstacle corner vertices. Total vertices: ${currentVertices.length}.`
  );

  // 3. Initialize graph structure
  const vgraph: Map<string, Point[]> = new Map();
  currentVertices.forEach((v) => vgraph.set(getKeyString(v), []));

  phases.push({
    id: phase1Id,
    name: 'Initialization',
    description:
      'We begin by defining the nodes (vertices) of our graph. These include the start point, the goal point, and all vertices of the obstacles.',
    pseudocode: `// 1. Define Vertices
V = {start, goal} + Vertices(obstacles)`,
    complexity: 'O(V)',
    startStepIndex: startIdx1,
    endStepIndex: steps.length - 1,
  });

  // --- PHASE 2: ADD VISIBLE EDGES ---
  const phase2Id = 'visibility';
  const startIdx2 = steps.length;

  const ccw = (A: Point, B: Point, C: Point): boolean => (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);
  const segmentsIntersect = (A: Point, B: Point, C: Point, D: Point): boolean =>
    ccw(A, C, D) !== ccw(B, C, D) && ccw(A, B, C) !== ccw(A, B, D);

  const isVisible = (p1: Point, p2: Point): boolean => {
    for (const polygon of polygons) {
      let selfIntersectionCounter = 0;
      for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i];
        const b = polygon[(i + 1) % polygon.length];

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
      }
      // Check if the line segment is inside the polygon
      if (selfIntersectionCounter > 3) return false;
    }
    return true;
  };

  const NUM_SOURCE_POINTS = 3; // Show all edge checks for the first N source points

  for (let i = 0; i < currentVertices.length; i++) {
    const shouldShowSource = i < NUM_SOURCE_POINTS;

    for (let j = i + 1; j < currentVertices.length; j++) {
      const v1 = currentVertices[i];
      const v2 = currentVertices[j];
      const shouldShowStep = shouldShowSource;

      if (shouldShowStep) {
        addStep(
          phase2Id,
          `Checking visibility between (${Math.round(v1.x)}, ${Math.round(v1.y)}) and (${Math.round(v2.x)}, ${Math.round(v2.y)})`,
          {
            scanLine: [v1, v2],
            activeState: 'checking',
          }
        );
      }

      if (isVisible(v1, v2)) {
        currentEdges.push([v1, v2]);
        vgraph.get(getKeyString(v1))?.push(v2);
        vgraph.get(getKeyString(v2))?.push(v1);

        if (shouldShowStep) {
          addStep(phase2Id, 'Line of sight is clear. Edge added.', {
            activeEdge: [v1, v2],
            activeState: 'valid',
          });
        }
      } else {
        if (shouldShowStep) {
          addStep(phase2Id, 'Line of sight blocked by obstacle.', {
            scanLine: [v1, v2],
            activeState: 'invalid',
          });
        }
      }
    }
  }

  // Add final frame showing complete graph
  addStep(phase2Id, 'Visibility graph complete. All edges computed.', {
    activeState: 'valid',
  });

  phases.push({
    id: phase2Id,
    name: 'Building Visibility Graph',
    description:
      'We check line of sight between vertices to build the graph. An edge connects two vertices only if the line segment between them is unobstructed. The visualization shows all checks from the first few source vertices.',
    pseudocode: `For each pair of vertices (u, v) in V:
    If LOS(u, v) is clear (does not intersect any obstacle edge):
        Add edge (u, v) to G

# LOS check helper:
function SegmentsIntersect(A, B, C, D):
    return CCW(A, C, D) != CCW(B, C, D) AND CCW(A, B, C) != CCW(A, B, D)`,
    complexity: 'O(V^3)',
    startStepIndex: startIdx2,
    endStepIndex: steps.length - 1,
  });

  // --- PHASE 3: PATHFINDING (A*) ---
  const phase3Id = 'astar';
  const startIdx3 = steps.length;

  const pathResult = runAStar(start, goal, vgraph);

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
      'With the complete visibility graph built, the A* search algorithm is used to find the shortest path from the start node to the goal node. A* minimizes the total estimated cost f(n) = g(n) + h(n), where g(n) is the actual cost from the start to node n, and h(n) is the Euclidean distance (straight-line distance) from node n to the goal, serving as an admissible heuristic.',
    pseudocode: `OpenSet = {Start}
gScore[Start] = 0
fScore[Start] = h(Start, Goal)

While OpenSet is not empty:
    Current = node in OpenSet with lowest fScore
    If Current == Goal:
        Reconstruct path and return
    For each neighbor of Current in G:
        tentative_g = gScore[Current] + distance(Current, neighbor)
        If tentative_g < gScore[neighbor]:
            gScore[neighbor] = tentative_g
            fScore[neighbor] = tentative_g + h(neighbor, Goal)
            Parent[neighbor] = Current
            Add neighbor to OpenSet`,
    complexity: 'O(E log V)',
    startStepIndex: startIdx3,
    endStepIndex: steps.length - 1,
  });

  return { steps, phases };
}
