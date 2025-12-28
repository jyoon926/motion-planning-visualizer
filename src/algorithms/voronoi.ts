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
  const margin = 10;

  for (let x = margin; x <= width - margin; x += sampleDist) vertices.push({ x, y: margin }, { x, y: height - margin });
  for (let y = sampleDist; y < height - margin; y += sampleDist)
    vertices.push({ x: margin, y }, { x: width - margin, y });

  addStep(phase1Id, 'Sampled canvas boundaries.', { activeState: 'neutral' });

  // Sample Obstacle Edges
  let obsPointsCount = 0;
  const obstacles = [];
  for (const poly of polygons) {
    const obsPoints = [];
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
        obsPoints.push({
          x: p1.x + t * (p2.x - p1.x),
          y: p1.y + t * (p2.y - p1.y),
        });
        obsPointsCount++;
      }
    }
    obstacles.push(obsPoints);
  }
  addStep(phase1Id, `Sampled ${obsPointsCount} points along obstacle edges.`);

  phases.push({
    id: phase1Id,
    name: 'Sampling',
    description:
      'The first step is to generate the points that define the Voronoi diagram. We include the Start and Goal positions, plus we add a grid of points along the canvas boundaries and points sampled along the edges of every obstacle. These samples become the input to Delaunay triangulation.',
    pseudocode: `Sites = {Start, Goal}

For boundary at interval D:
    Add boundary samples to Sites

For each obstacle edge (A, B):
    samples = ceil(length(A,B) / D)
    For t from 0 to num_samples:
        // Interpolate to get a point on the edge
        P = A + t * (B - A) / num_samples
        Add P to Sites`,
    complexity: 'O(perimeter/D)',
    startStepIndex: startIdx1,
    endStepIndex: steps.length - 1,
  });

  // --- PHASE 2: DELAUNAY TRIANGULATION ---
  const phase2Id = 'delaunay';
  const startIdx2 = steps.length;
  let delaunayPointIndex = 0;

  // Delaunay triangulation with visualization
  const triangles = manualDelaunay(vertices, (currentTris, newPoint, badTris, _, newTris) => {
    const triArray: Array<[Point, Point, Point]> = currentTris.map((t) => [t.p1, t.p2, t.p3]);

    if (newPoint && !badTris && !newTris) {
      addStep(
        phase2Id,
        `Inserting point ${delaunayPointIndex + 1}: (${Math.round(newPoint.x)}, ${Math.round(newPoint.y)})`,
        {
          triangles: triArray,
          activeNode: newPoint,
        }
      );
    }

    if (badTris && badTris.length > 0) {
      const badTriArray: Array<[Point, Point, Point]> = badTris.map((t) => [t.p1, t.p2, t.p3]);

      // Calculate circumcircles for visualization
      const circumcircles = badTris.map((t) => {
        const center = getCircumcenter(t.p1, t.p2, t.p3);
        const radius = Math.hypot(center.x - t.p1.x, center.y - t.p1.y);
        return { center, radius };
      });

      addStep(phase2Id, `Found ${badTris.length} triangle(s) whose circumcircle contains the new point`, {
        triangles: triArray,
        activeTriangles: badTriArray,
        activeNode: newPoint,
        circumcircles,
      });
    }

    if (newTris && newTris.length > 0) {
      const newTriArray: Array<[Point, Point, Point]> = newTris.map((t) => [t.p1, t.p2, t.p3]);
      addStep(phase2Id, `Removed bad triangles and created ${newTris.length} new triangle(s)`, {
        triangles: triArray,
        newTriangles: newTriArray,
        activeNode: newPoint,
      });
    }

    // Increment only when we've finished processing a point (when newTris is provided)
    if (newTris) {
      delaunayPointIndex++;
    }
  });

  const triArray: Array<[Point, Point, Point]> = triangles.map((t) => [t.p1, t.p2, t.p3]);
  addStep(phase2Id, `Delaunay triangulation complete with ${triangles.length} triangles.`, {
    triangles: triArray,
  });

  phases.push({
    id: phase2Id,
    name: 'Delaunay Triangulation',
    description:
      'Then, we create a set of triangles (a triangulation) using the sites from Phase 1. We use the Bowyer-Watson algorithm, which ensures that the triangulation is Delaunay: no site is inside the circumcircle of any triangle. This property is crucial because it maximizes the minimum internal angle, leading to a "well-formed" and stable mesh. This mesh forms the geometric dual of the Voronoi diagram.',
    pseudocode: `Triangulation = [SuperTriangle]
For each point P:
    BadTriangles = {T | P inside circumcircle(T)}
    Boundary = unique edges of BadTriangles
    Remove BadTriangles
    For each boundary edge (A, B):
        Add triangle (A, B, P)`,
    complexity: 'O(n log n) expected',
    startStepIndex: startIdx2,
    endStepIndex: steps.length - 1,
  });

  // --- PHASE 3: VORONOI DIAGRAM ---
  const phase3Id = 'voronoi';
  const startIdx3 = steps.length;

  // Voronoi diagram construction with visualization
  const circumcenters = new Map<Triangle, Point>();
  const circumcenterArray: Point[] = [];
  const allCircumcircles: Array<{ center: Point; radius: number }> = [];
  let circumcenterCount = 0;

  for (const tri of triangles) {
    const circumcenter = getCircumcenter(tri.p1, tri.p2, tri.p3);
    const radius = Math.hypot(circumcenter.x - tri.p1.x, circumcenter.y - tri.p1.y);

    circumcenters.set(tri, circumcenter);
    circumcenterArray.push(circumcenter);
    allCircumcircles.push({ center: circumcenter, radius });

    addStep(phase3Id, `Circumcenter ${circumcenterCount + 1}/${triangles.length} found.`, {
      triangles: triArray,
      activeTriangles: [[tri.p1, tri.p2, tri.p3]],
      circumcenters: [...circumcenterArray],
      activeCircumcenter: circumcenter,
      circumcircles: [{ center: circumcenter, radius }],
    });

    circumcenterCount++;
  }

  addStep(phase3Id, `All ${triangles.length} circumcenters computed`, {
    triangles: triArray,
    circumcenters: circumcenterArray,
  });

  let voronoiEdgeStepCount = 0;

  const vorEdges = manualVoronoi(triangles, start, goal, circumcenters, (edgesSoFar, newEdge, isConnectingSpecial) => {
    if (!isConnectingSpecial) {
      edges = edgesSoFar;
      addStep(phase3Id, `Voronoi edge ${edgesSoFar.length}: connecting adjacent circumcenters`, {
        circumcenters: circumcenterArray,
        activeEdge: newEdge,
      });
      voronoiEdgeStepCount++;
    }
  });

  // Show start/goal connection in one step
  edges = vorEdges;
  const startGoalEdges: [Point, Point][] = [];
  for (const edge of vorEdges) {
    if (edge[0] === start || edge[0] === goal || edge[1] === start || edge[1] === goal) {
      startGoalEdges.push(edge);
    }
  }

  addStep(phase3Id, `Connected all Voronoi edges`, {
    circumcenters: circumcenterArray,
    activeEdge: startGoalEdges.length > 0 ? startGoalEdges[0] : undefined,
  });

  addStep(phase3Id, `Voronoi diagram complete: ${vorEdges.length} edges`, {
    circumcenters: circumcenterArray,
  });

  phases.push({
    id: phase3Id,
    name: 'Voronoi Diagram',
    description:
      "The Voronoi diagram (or Voronoi Graph) is derived from the Delaunay triangulation. Each triangle's circumcenter becomes a Voronoi vertex. When two Delaunay triangles share an edge, their circumcenters are connected, forming a Voronoi edge. This creates a partitioning where each cell contains points closest to a specific site.",
    pseudocode: `For each Delaunay triangle T:
    Circumcenters[T] = Circumcenter(T)

For each shared edge between triangles T1, T2:
    Add edge (Circumcenters[T1], Circumcenters[T2])

Connect Start and Goal to their respective cells`,
    complexity: 'O(n)',
    startStepIndex: startIdx3,
    endStepIndex: steps.length - 1,
  }); // --- PHASE 4: FILTERING & CONNECTION ---
  const phase4Id = 'filtering';
  const startIdx4 = steps.length;

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

  for (const [p1, p2] of vorEdges) {
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

  addStep(phase4Id, `Filtered edges. ${validEdgesCount} edges remain valid (clear of obstacles).`);

  phases.push({
    id: phase4Id,
    name: 'Filtering',
    description:
      'Not all Voronoi edges are valid for pathfinding. In this phase, we clean the graph by removing any edge that is blocked by an obstacle or that extends beyond the canvas boundaries. The remaining set of edges and circumcenters forms a safe, traversable, collision-free graph that the pathfinding algorithm will use.',
    pseudocode: `Graph = empty
For each Voronoi edge (A, B):
    If A or B outside canvas: skip
    If edge intersects any obstacle: skip
    Add A→B and B→A to Graph`,
    complexity: 'O(E * V_obstacles)',
    startStepIndex: startIdx4,
    endStepIndex: steps.length - 1,
  });

  // --- PHASE 5: SEARCH PATH ---
  const phase5Id = 'search';
  const startIdx5 = steps.length;

  const foundPath = runAStar(start, goal, graph);

  if (foundPath.length > 0) {
    path = foundPath;
    addStep(phase5Id, 'Path found!', { activeState: 'valid' });
  } else {
    addStep(phase5Id, 'No path found.', { activeState: 'invalid' });
  }

  phases.push({
    id: phase5Id,
    name: 'A* Search',
    description:
      'With the filtered, collision-free Voronoi graph, we now use the A* search algorithm to find the shortest path from Start to Goal. A* efficiently explores the graph by minimizing the total estimated cost f(n) = g(n) + h(n), where g(n) is the actual cost from the start to node n, and h(n) is the Euclidean distance (straight-line distance) from node n to the goal.',
    pseudocode: `OpenSet = {Start}, gScore[Start] = 0
fScore[Start] = h(Start, Goal)

While OpenSet not empty:
    Current = node with lowest fScore
    If Current == Goal: return path
    For each neighbor of Current:
        tentative_g = gScore[Current] + dist
        If tentative_g < gScore[neighbor]:
            Update scores and parent`,
    complexity: 'O(E log V)',
    startStepIndex: startIdx5,
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

type Triangle = {
  p1: Point;
  p2: Point;
  p3: Point;
};

type Edge = [Point, Point];

// Returns true if point p lies inside circumcircle of triangle t
function pointInCircumcircle(p: Point, t: Triangle): boolean {
  const { p1, p2, p3 } = t;

  const ax = p1.x - p.x;
  const ay = p1.y - p.y;
  const bx = p2.x - p.x;
  const by = p2.y - p.y;
  const cx = p3.x - p.x;
  const cy = p3.y - p.y;

  const det =
    (ax * ax + ay * ay) * (bx * cy - cx * by) -
    (bx * bx + by * by) * (ax * cy - cx * ay) +
    (cx * cx + cy * cy) * (ax * by - bx * ay);

  // triangle orientation (positive = CCW)
  const orient = (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x);

  // If triangle is CW, the determinant flips sign
  return orient > 0 ? det > 0 : det < 0;
}

// Creates a canonical ordered edge representation so duplicates can be removed
function canonicalEdge(p1: Point, p2: Point): Edge {
  return p1.x < p2.x || (p1.x === p2.x && p1.y <= p2.y) ? [p1, p2] : [p2, p1];
}

function sameEdge(e1: Edge, e2: Edge): boolean {
  return e1[0].x === e2[0].x && e1[0].y === e2[0].y && e1[1].x === e2[1].x && e1[1].y === e2[1].y;
}

function manualDelaunay(
  points: Point[],
  onStep?: (
    currentTriangles: Triangle[],
    newPoint?: Point,
    badTriangles?: Triangle[],
    boundaryEdges?: Edge[],
    newTriangles?: Triangle[]
  ) => void
): Triangle[] {
  // Start with a single large supertriangle that encloses all the points
  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));

  const dx = maxX - minX;
  const dy = maxY - minY;
  const deltaMax = Math.max(dx, dy) * 10;

  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;

  const p1 = { x: midX - deltaMax, y: midY - deltaMax };
  const p2 = { x: midX, y: midY + deltaMax };
  const p3 = { x: midX + deltaMax, y: midY - deltaMax };

  let triangles: Triangle[] = [{ p1, p2, p3 }];

  // Insert the points one at a time
  for (const point of points) {
    onStep?.(triangles, point);

    const badTriangles: Triangle[] = [];

    // Find all triangles whose circumcircle contains the given point
    for (const tri of triangles) {
      if (pointInCircumcircle(point, tri)) {
        badTriangles.push(tri);
      }
    }

    onStep?.(triangles, point, badTriangles);

    // Find all boundary edges of the polygonal hole
    const boundaryEdges: Edge[] = [];

    for (const tri of badTriangles) {
      const edges: Edge[] = [
        canonicalEdge(tri.p1, tri.p2),
        canonicalEdge(tri.p2, tri.p3),
        canonicalEdge(tri.p3, tri.p1),
      ];

      for (const e of edges) {
        const idx = boundaryEdges.findIndex((edge) => sameEdge(edge, e));
        if (idx === -1) {
          boundaryEdges.push(e);
        } else {
          boundaryEdges.splice(idx, 1);
        }
      }
    }

    // Remove the "bad" triangles
    triangles = triangles.filter((t) => !badTriangles.includes(t));

    // Create new triangles that replace the bad triangles removed
    const newTriangles: Triangle[] = [];
    for (const [a, b] of boundaryEdges) {
      const newTri = { p1: a, p2: b, p3: point };
      triangles.push(newTri);
      newTriangles.push(newTri);
    }

    onStep?.(triangles, point, undefined, boundaryEdges, newTriangles);
  }

  // Do last cleanup, removing triangles touching the original supertriangle points
  triangles = triangles.filter(
    (t) =>
      t.p1 !== p1 &&
      t.p2 !== p1 &&
      t.p3 !== p1 &&
      t.p1 !== p2 &&
      t.p2 !== p2 &&
      t.p3 !== p2 &&
      t.p1 !== p3 &&
      t.p2 !== p3 &&
      t.p3 !== p3
  );

  return triangles;
}

function getCircumcenter(a: Point, b: Point, c: Point): Point {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));

  const ux =
    ((a.x ** 2 + a.y ** 2) * (b.y - c.y) + (b.x ** 2 + b.y ** 2) * (c.y - a.y) + (c.x ** 2 + c.y ** 2) * (a.y - b.y)) /
    d;

  const uy =
    ((a.x ** 2 + a.y ** 2) * (c.x - b.x) + (b.x ** 2 + b.y ** 2) * (a.x - c.x) + (c.x ** 2 + c.y ** 2) * (b.x - a.x)) /
    d;

  return { x: ux, y: uy };
}

function edgeKey(a: Point, b: Point): string {
  // canonical ordering
  const p = a.x < b.x || (a.x === b.x && a.y <= b.y) ? a : b;
  const q = p === a ? b : a;
  return `${p.x},${p.y}-${q.x},${q.y}`;
}

function triangleContains(triangle: Triangle, target: Point): boolean {
  const a = triangle.p1;
  const b = triangle.p2;
  const c = triangle.p3;
  return (
    (a.x === target.x && a.y === target.y) ||
    (b.x === target.x && b.y === target.y) ||
    (c.x === target.x && c.y === target.y)
  );
}

function manualVoronoi(
  triangles: Triangle[],
  start: Point,
  goal: Point,
  circumcenters: Map<Triangle, Point>,
  onStep?: (edges: Edge[], newEdge?: Edge, isConnectingSpecial?: boolean) => void
): Edge[] {
  // Create adjacency for triangles
  const edgeMap = new Map<string, Triangle[]>();
  const vorEdges: Edge[] = [];

  for (const tri of triangles) {
    const edges: Edge[] = [
      [tri.p1, tri.p2],
      [tri.p2, tri.p3],
      [tri.p3, tri.p1],
    ];

    for (const [a, b] of edges) {
      const key = edgeKey(a, b);
      if (!edgeMap.has(key)) edgeMap.set(key, []);
      edgeMap.get(key)!.push(tri);
    }
  }

  // Create all regular Voronoi edges
  for (const [_, tris] of edgeMap.entries()) {
    if (tris.length === 2) {
      const c1 = circumcenters.get(tris[0]);
      const c2 = circumcenters.get(tris[1]);
      const edge: Edge = [c1!, c2!];
      vorEdges.push(edge);
      onStep?.(vorEdges, edge, false);
    }
  }

  // Connect start and goal (done outside, after this function returns)
  for (const tri of triangles) {
    if (triangleContains(tri, start)) {
      const edge: Edge = [start, circumcenters.get(tri)!];
      vorEdges.push(edge);
    }
    if (triangleContains(tri, goal)) {
      const edge: Edge = [goal, circumcenters.get(tri)!];
      vorEdges.push(edge);
    }
  }

  return vorEdges;
}
