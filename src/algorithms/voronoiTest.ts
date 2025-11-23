import { Delaunay } from 'd3-delaunay';
import { runAStar } from './astar';
import { getKeyString } from '../utils/common';
import type { AlgorithmOutput, AlgorithmPhase, AlgorithmStep, Parameters, Point } from '../utils/types';

export function computeVoronoi(
  start: Point,
  goal: Point,
  polygons: Point[][],
  canvasSize: { width: number; height: number },
  params: Parameters
): AlgorithmOutput {
  const steps: AlgorithmStep[] = [];
  const phases: AlgorithmPhase[] = [];

  const vertices: Point[] = [];
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
  };

  // --- PHASE 1: SAMPLING ---
  const phase1Id = 'sampling';
  const startIdx1 = steps.length;

  // Add Start/Goal
  vertices.push(start, goal);
  addStep(phase1Id, 'Added Start and Goal points.');

  // Sample boundary
  const { width, height } = canvasSize;
  const sampleDist = params.voronoiSampleDist || 40;

  for (let x = 0; x <= width; x += sampleDist) vertices.push({ x, y: 0 }, { x, y: height });
  for (let y = sampleDist; y < height; y += sampleDist) vertices.push({ x: 0, y }, { x: width, y });

  addStep(phase1Id, 'Sampled canvas boundaries.', { activeState: 'neutral' });

  // Sample Obstacle Edges
  let obsPointsCount = 0;
  for (const poly of polygons) {
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
      'We begin by generating a large set of sample points (sites) that will define the Voronoi diagram. These include: start and goal positions, points sampled at regular intervals along the canvas boundaries, and points sampled along each obstacle edge. These sites form the input to the Delaunay triangulation and Voronoi diagram computation.',
    pseudocode: `
Sites = empty set
Add Start to Sites
Add Goal to Sites

// Sample world boundaries at interval D
For x = 0 → width step D:
    Add point (x, 0) and (x, height) to Sites
For y = 0 → height step D:
    Add point (0, y) and (width, y) to Sites

// Sample each obstacle edge
For each polygon P in Obstacles:
    For each edge (A, B) in P:
        dist = length(A, B)
        samples = ceil(dist / D)
        For s = 0 → samples:
            t = s / samples
            sample = A + t * (B - A)
            Add sample to Sites
`,
    complexity: 'O((N + boundaryLength + obstaclePerimeter)/D)',
    startStepIndex: startIdx1,
    endStepIndex: steps.length - 1,
  });

  // --- PHASE 2: DIAGRAM GENERATION ---
  const phase2Id = 'diagram';
  const startIdx2 = steps.length;

  const delaunay = Delaunay.from(
    vertices,
    (d) => d.x,
    (d) => d.y
  );
  const voronoi = delaunay.voronoi([0, 0, width, height]);

  // Extract raw edges from Voronoi
  const rawEdges: [Point, Point][] = [];
  const edgeSet = new Set<string>();

  for (let i = 0; i < vertices.length; i++) {
    const cell = voronoi.cellPolygon(i);
    if (!cell) continue;

    for (let j = 0; j < cell.length - 1; j++) {
      const p1 = { x: cell[j][0], y: cell[j][1] };
      const p2 = { x: cell[j + 1][0], y: cell[j + 1][1] };

      if (Math.abs(p1.x) < 0.1 || Math.abs(p1.y) < 0.1 || Math.abs(p1.x - width) < 0.1) continue;

      const k1 = getKeyString(p1);
      const k2 = getKeyString(p2);
      if (k1 === k2) continue;

      const edgeKey = k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
      if (!edgeSet.has(edgeKey)) {
        edgeSet.add(edgeKey);
        rawEdges.push([p1, p2]);
      }
    }
  }

  edges = rawEdges;
  addStep(phase2Id, `Computed Voronoi Diagram. Generated ${rawEdges.length} candidate edges.`);

  phases.push({
    id: phase2Id,
    name: 'Voronoi Diagram',
    description:
      'We construct a Voronoi diagram from the sampled sites using the Delaunay triangulation. The edges of Voronoi cells represent paths that are maximally far from obstacles.',
    pseudocode: `
D = DelaunayTriangulation(Sites)
V = VoronoiDiagram(D)

Edges = empty set
For each Site i:
    Cell = VoronoiCell(i)
    For each consecutive pair (A, B) in Cell boundary:
        If A == B: continue
        If A or B lies at infinity or canvas boundary: skip
        Add edge (A, B) to Edges (if not already added)
`,
    complexity: 'O(S log S)',
    startStepIndex: startIdx2,
    endStepIndex: steps.length - 1,
  });

  // --- PHASE 3: FILTERING & CONNECTION ---
  const phase3Id = 'filtering';
  const startIdx3 = steps.length;

  // Connect Start/Goal to Voronoi cells
  const connectToCell = (siteIdx: number, origin: Point) => {
    const cell = voronoi.cellPolygon(siteIdx);
    if (!cell) return;
    for (const [cx, cy] of cell) {
      const p = { x: cx, y: cy };
      if (p.x <= 1 || p.x >= width - 1 || p.y <= 1 || p.y >= height - 1) continue;
      rawEdges.push([origin, p]);
    }
  };

  connectToCell(0, start);
  connectToCell(1, goal);
  addStep(phase3Id, 'Connected Start and Goal to the graph.');

  // Filter edges against obstacles
  const graph = new Map<string, Point[]>();

  const lineIntersectsPoly = (a: Point, b: Point, poly: Point[]) => {
    for (let i = 0; i < poly.length; i++) {
      const p1 = poly[i];
      const p2 = poly[(i + 1) % poly.length];
      if (segmentsIntersect(a, b, p1, p2)) return true;
    }
    return isPointInPoly(a, poly) || isPointInPoly(b, poly);
  };

  let validEdgesCount = 0;

  const addToGraph = (p1: Point, p2: Point) => {
    const k1 = getKeyString(p1);
    const k2 = getKeyString(p2);
    if (!graph.has(k1)) graph.set(k1, []);
    if (!graph.has(k2)) graph.set(k2, []);
    graph.get(k1)!.push(p2);
    graph.get(k2)!.push(p1);
  };

  edges = [];

  for (const [p1, p2] of rawEdges) {
    let blocked = false;

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
    }

    for (const obs of polygons) {
      if (lineIntersectsPoly(p1, p2, obs)) {
        blocked = true;
        break;
      }
    }

    if (!blocked) {
      edges.push([p1, p2]);
      addToGraph(p1, p2);
      validEdgesCount++;
    }
  }

  addStep(phase3Id, `Filtered edges. ${validEdgesCount} edges remain valid (clear of obstacles).`);

  phases.push({
    id: phase3Id,
    name: 'Filtering',
    description:
      'Before searching, the Voronoi graph must be cleaned. We connect Start and Goal to the Voronoi cells surrounding them, then remove any edge that intersects obstacles or lies outside the canvas interior. Remaining edges form the adjacency graph for pathfinding.',
    pseudocode: `
function ConnectSiteToVoronoiGraph(SiteIndex, SitePoint):
    Cell = VoronoiCell(SiteIndex)
    For each vertex V in Cell:
        If V is inside canvas (margin > 0):
            Add (SitePoint, V) to Edges

Connect Start and Goal
For each edge (A, B) in Edges:
    If A or B outside canvas: skip
    blocked = false
    For each obstacle P:
        If segment(A, B) intersects P:
            blocked = true
    If not blocked:
        Graph[A].push(B)
        Graph[B].push(A)
`,
    complexity: 'O(E * V_obs)',
    startStepIndex: startIdx3,
    endStepIndex: steps.length - 1,
  });

  // --- PHASE 4: SEARCH PATH ---
  const phase4Id = 'search';
  const startIdx4 = steps.length;

  const foundPath = runAStar(start, goal, graph);

  if (foundPath.length > 0) {
    path = foundPath;
    addStep(phase4Id, 'Path found!', { activeState: 'valid' });
  } else {
    addStep(phase4Id, 'No path found.', { activeState: 'invalid' });
  }

  phases.push({
    id: phase4Id,
    name: 'A* Search',
    description:
      'Run A* search on the cleaned Voronoi graph from Start to Goal. The graph nodes are Voronoi vertices and edges are collision-free line segments.',
    pseudocode: `
Path = AStar(Start, Goal, Graph)
If Path exists:
    return Path
Else:
    return failure
`,
    complexity: 'O(E log V)',
    startStepIndex: startIdx4,
    endStepIndex: steps.length - 1,
  });

  return { steps, phases };
}

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
