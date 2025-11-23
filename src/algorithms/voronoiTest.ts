import { Delaunay } from 'd3-delaunay';
import { runAStar } from './astar';
import { getKeyString } from '../utils/common';
import { expandPolygon } from '../utils/geometry';
import type { AlgorithmOutput, AlgorithmPhase, AlgorithmStep, Parameters, Point } from '../utils/types';

export function computeVoronoi(
  start: Point,
  goal: Point,
  rawPolygons: Point[][],
  canvasSize: { width: number; height: number },
  params: Parameters
): AlgorithmOutput {
  const steps: AlgorithmStep[] = [];
  const phases: AlgorithmPhase[] = []; // Snapshot State

  let vertices: Point[] = [];
  let edges: [Point, Point][] = [];
  let path: Point[] = [];

  const addStep = (phaseId: string, message: string, extras: Partial<AlgorithmStep> = {}) => {
    steps.push({
      phaseId,
      message,
      vertices: [...vertices],
      edges: [...edges],
      path: [...path],
      ...extras,
    });
  }; // --- PHASE 1: SAMPLING ---

  const phase1Id = 'sampling';
  const startIdx1 = steps.length; // 1a. Inflate obstacles for margin calculations

  const inflatedObstacles = rawPolygons.map((p) => expandPolygon(p, params.obstacleMargin)); // 1b. Add Start/Goal

  vertices.push(start, goal);
  addStep(phase1Id, 'Added Start and Goal points.'); // 1c. Sample Boundary

  const { width, height } = canvasSize;
  const sampleDist = params.voronoiSampleDist || 40;

  for (let x = 0; x <= width; x += sampleDist) vertices.push({ x, y: 0 }, { x, y: height });
  for (let y = sampleDist; y < height; y += sampleDist) vertices.push({ x: 0, y }, { x: width, y });

  addStep(phase1Id, 'Sampled canvas boundaries.', { activeState: 'neutral' }); // 1d. Sample Obstacle Edges (using raw polygons for sampling, but inflated for collision later)
  // We sample the RAW polygons because the Voronoi generator needs to wrap around the actual objects.
  // The "margin" is enforced by filtering edges that get too close later.

  let obsPointsCount = 0;
  for (const poly of rawPolygons) {
    for (let i = 0; i < poly.length; i++) {
      const p1 = poly[i];
      const p2 = poly[(i + 1) % poly.length];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const samples = Math.max(1, Math.ceil(dist / sampleDist));

      for (let s = 0; s < samples; s++) {
        const t = s / samples;
        vertices.push({
          x: p1.x + t * (p2.x - p1.x),
          y: p1.y + t * (p2.y - p1.y),
        });
        obsPointsCount++;
      }
    }
  }
  addStep(phase1Id, `Sampled ${obsPointsCount} points along obstacle edges.`);

  phases.push({
    id: phase1Id,
    name: 'Sampling',
    description:
      'We generate a cloud of points to serve as sites for the Voronoi diagram. Points are sampled along the canvas boundary and the edges of every obstacle.',
    pseudocode: `Sites = {Start, Goal}
For each edge in Obstacles + Bounds:
  Add points at interval D`,
    complexity: 'O(N/D)',
    startStepIndex: startIdx1,
    endStepIndex: steps.length - 1,
  }); // --- PHASE 2: DIAGRAM GENERATION ---

  const phase2Id = 'diagram';
  const startIdx2 = steps.length;

  const delaunay = Delaunay.from(
    vertices,
    (d) => d.x,
    (d) => d.y
  );
  const voronoi = delaunay.voronoi([0, 0, width, height]); // Extract raw edges from Voronoi

  const rawEdges: [Point, Point][] = [];
  const edgeSet = new Set<string>(); // De-dupe

  for (let i = 0; i < vertices.length; i++) {
    const cell = voronoi.cellPolygon(i);
    if (!cell) continue;

    for (let j = 0; j < cell.length - 1; j++) {
      // cell includes closure point usually
      const p1 = { x: cell[j][0], y: cell[j][1] };
      const p2 = { x: cell[j + 1][0], y: cell[j + 1][1] }; // Filter out edges that are technically at infinity or bounds (simplified check)

      if (Math.abs(p1.x) < 0.1 || Math.abs(p1.y) < 0.1 || Math.abs(p1.x - width) < 0.1) continue;

      const k1 = getKeyString(p1);
      const k2 = getKeyString(p2);
      if (k1 === k2) continue; // Unique key for edge

      const edgeKey = k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
      if (!edgeSet.has(edgeKey)) {
        edgeSet.add(edgeKey);
        rawEdges.push([p1, p2]);
      }
    }
  } // --- VISUALIZATION ADDITION: Show the raw Voronoi edges ---

  edges = rawEdges;
  addStep(phase2Id, `Computed Voronoi Diagram. Generated ${rawEdges.length} candidate edges.`);

  phases.push({
    id: phase2Id,
    name: 'Voronoi Diagram',
    description:
      'We compute the Voronoi diagram (dual of Delaunay triangulation). The edges of the Voronoi cells represent paths that are equidistant from the nearest obstacles, naturally maximizing clearance.',
    pseudocode: `Compute Delaunay(Sites)
Construct Dual Graph (Voronoi)
Extract Edges`,
    complexity: 'O(N log N)',
    startStepIndex: startIdx2,
    endStepIndex: steps.length - 1,
  }); // --- PHASE 3: FILTERING & CONNECTION ---

  const phase3Id = 'filtering';
  const startIdx3 = steps.length; // 1. Connect Start/Goal to their enclosing Voronoi cell
  // The edges added here are pushed to rawEdges, to be filtered next.

  const connectToCell = (siteIdx: number, origin: Point) => {
    const cell = voronoi.cellPolygon(siteIdx);
    if (!cell) return;
    for (const [cx, cy] of cell) {
      const p = { x: cx, y: cy }; // Don't add if it's a boundary point
      if (p.x <= 1 || p.x >= width - 1 || p.y <= 1 || p.y >= height - 1) continue;
      rawEdges.push([origin, p]);
    }
  }; // Index 0 is Start, Index 1 is Goal (based on insertion order)

  connectToCell(0, start);
  connectToCell(1, goal);
  addStep(phase3Id, 'Connected Start and Goal to the graph.'); // 2. Filter Edges against Obstacles (using INFLATED obstacles for margin)

  const graph = new Map<string, Point[]>();

  const lineIntersectsPoly = (a: Point, b: Point, poly: Point[]) => {
    // Basic segment-segment intersection check against all poly edges
    for (let i = 0; i < poly.length; i++) {
      const p1 = poly[i];
      const p2 = poly[(i + 1) % poly.length];
      if (segmentsIntersect(a, b, p1, p2)) return true;
    }
    return isPointInPoly(a, poly) || isPointInPoly(b, poly); // Check if inside
  };

  let validEdgesCount = 0; // Helper to add to adjacency list

  const addToGraph = (p1: Point, p2: Point) => {
    const k1 = getKeyString(p1);
    const k2 = getKeyString(p2);
    if (!graph.has(k1)) graph.set(k1, []);
    if (!graph.has(k2)) graph.set(k2, []);
    graph.get(k1)!.push(p2);
    graph.get(k2)!.push(p1);
  }; // --- VISUALIZATION ADDITION: Clear raw edges for filtering display ---

  edges = []; // Clear the visual edges now that we are filtering

  for (const [p1, p2] of rawEdges) {
    let blocked = false; // Check boundaries

    if (
      p1.x <= 1 ||
      p1.x >= width - 1 ||
      p1.y <= 1 ||
      p1.y >= height - 1 ||
      p2.x <= 1 ||
      p2.x >= width - 1 ||
      p2.y <= 1 ||
      p2.y >= height - 1
    ) {
      continue;
    } // Check against inflated obstacles

    for (const obs of inflatedObstacles) {
      if (lineIntersectsPoly(p1, p2, obs)) {
        blocked = true;
        break;
      }
    }

    if (!blocked) {
      edges.push([p1, p2]); // Add to visual list
      addToGraph(p1, p2); // Add to logical graph
      validEdgesCount++;
    }
  }

  addStep(phase3Id, `Filtered edges. ${validEdgesCount} edges remain valid (clear of obstacles).`, {
    codeLine: 2,
  });

  phases.push({
    id: phase3Id,
    name: 'Filtering',
    description:
      'We remove edges that intersect obstacles or the canvas boundary. We also check against the "margin" by using inflated obstacle shapes.',
    pseudocode: `For each edge (u, v):
  If Intersects(u, v, InflatedObstacles):
    Discard
  Else:
    AddToGraph(u, v)`,
    complexity: 'O(E * V_obs)',
    startStepIndex: startIdx3,
    endStepIndex: steps.length - 1,
  }); // --- PHASE 4: SEARCH ---

  const phase4Id = 'search';
  const startIdx4 = steps.length;

  const foundPath = runAStar(start, goal, graph, (msg, meta) => {
    addStep(phase4Id, msg, meta);
  });

  if (foundPath.length > 0) {
    path = foundPath;
    addStep(phase4Id, 'Path found!', { activeState: 'valid' });
  } else {
    addStep(phase4Id, 'No path found.', { activeState: 'invalid' });
  }

  phases.push({
    id: phase4Id,
    name: 'A* Search',
    description: 'Find the shortest path through the remaining valid Voronoi edges.',
    pseudocode: 'AStar(Start, Goal, Graph)',
    complexity: 'O(E log V)',
    startStepIndex: startIdx4,
    endStepIndex: steps.length - 1,
  });

  return { steps, phases };
}

// --- Helpers internal to Voronoi filtering ---

function ccw(A: Point, B: Point, C: Point): boolean {
  return (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);
}

function segmentsIntersect(A: Point, B: Point, C: Point, D: Point): boolean {
  return ccw(A, C, D) !== ccw(B, C, D) && ccw(A, B, C) !== ccw(A, B, D);
}

function isPointInPoly(p: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x,
      yi = poly[i].y;
    const xj = poly[j].x,
      yj = poly[j].y;
    const intersect = yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
