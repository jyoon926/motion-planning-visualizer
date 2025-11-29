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

  // manual voronoi creation starts here
  const triangles = manualDelaunay(vertices)

  const rawTriangleEdges: [Point, Point][] = [];

  for (const tri of triangles) {
    rawTriangleEdges.push([tri.p1, tri.p2])
    rawTriangleEdges.push([tri.p3, tri.p2])
    rawTriangleEdges.push([tri.p1, tri.p3])
  }

  edges = rawTriangleEdges;
  addStep(phase2Id, `Computed delaunay traingulation. Generated some triangles.`);

  const vorEdges = manualVoronoi(triangles, start, goal)
  edges = vorEdges;
  addStep(phase2Id, 'Computed voronoi edges.')

  // const delaunay = Delaunay.from(
  //   vertices,
  //   (d) => d.x,
  //   (d) => d.y
  // );
  // const voronoi = delaunay.voronoi([0, 0, width, height]);

  // // Extract raw edges from Voronoi
  // const rawEdges: [Point, Point][] = [];
  // const edgeSet = new Set<string>();

  // for (let i = 0; i < vertices.length; i++) {
  //   const cell = voronoi.cellPolygon(i);
  //   if (!cell) continue;

  //   for (let j = 0; j < cell.length - 1; j++) {
  //     const p1 = { x: cell[j][0], y: cell[j][1] };
  //     const p2 = { x: cell[j + 1][0], y: cell[j + 1][1] };

  //     if (Math.abs(p1.x) < 0.1 || Math.abs(p1.y) < 0.1 || Math.abs(p1.x - width) < 0.1) continue;

  //     const k1 = getKeyString(p1);
  //     const k2 = getKeyString(p2);
  //     if (k1 === k2) continue;

  //     const edgeKey = k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
  //     if (!edgeSet.has(edgeKey)) {
  //       edgeSet.add(edgeKey);
  //       rawEdges.push([p1, p2]);
  //     }
  //   }
  // }

  // edges = rawEdges;
  // addStep(phase2Id, `Computed Voronoi Diagram. Generated ${rawEdges.length} candidate edges.`);

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

  // // Connect Start/Goal to Voronoi cells
  // const connectToCell = (siteIdx: number, origin: Point) => {
  //   const cell = voronoi.cellPolygon(siteIdx);
  //   if (!cell) return;
  //   for (const [cx, cy] of cell) {
  //     const p = { x: cx, y: cy };
  //     if (p.x <= 1 || p.x >= width - 1 || p.y <= 1 || p.y >= height - 1) continue;
  //     vorEdges.push([origin, p]);
  //   }
  // };

  // // This may only be working since it defines the cell around the start as 0 and the cell around the goal as 1
  // connectToCell(0, start);
  // connectToCell(1, goal);
  // addStep(phase3Id, 'Connected Start and Goal to the graph.');

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

type Triangle = {
  p1: Point;
  p2: Point;
  p3: Point;
};

type Edge = [Point, Point]

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
  const orient = (p2.x - p1.x) * (p3.y - p1.y) -
                  (p2.y - p1.y) * (p3.x - p1.x);

  // If triangle is CW, the determinant flips sign
  return orient > 0 ? det > 0 : det < 0;
}

// Creates a canonical ordered edge representation so duplicates can be removed
function canonicalEdge(p1: Point, p2: Point): Edge {
  return (p1.x < p2.x || (p1.x === p2.x && p1.y <= p2.y))
    ? [p1, p2] : [p2, p1];
}

function sameEdge(e1: Edge, e2: Edge): boolean {
  return (e1[0].x === e2[0].x && e1[0].y === e2[0].y &&
          e1[1].x === e2[1].x && e1[1].y === e2[1].y);
}

function manualDelaunay(points: Point[]): Triangle[] {
  // Start with a single large supertriangle that encloses all the points
  const minX = Math.min(...points.map(p => p.x));
  const maxX = Math.max(...points.map(p => p.x));
  const minY = Math.min(...points.map(p => p.y));
  const maxY = Math.max(...points.map(p => p.y));

  const dx = maxX - minX;
  const dy = maxY - minY;
  const deltaMax = Math.max(dx, dy) * 10;

  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;

  const p1 = { x: midX - deltaMax, y: midY - deltaMax };
  const p2 = { x: midX,            y: midY + deltaMax };
  const p3 = { x: midX + deltaMax, y: midY - deltaMax };

  let triangles: Triangle[] = [
    {p1, p2, p3}
  ];

  // Insert the points one at a time
  for (const point of points) {
    const badTriangles: Triangle[] = [];

    // Find all triangles whose circumcircle contains the given point
    for (const tri of triangles) {
      if (pointInCircumcircle(point, tri)) {
        badTriangles.push(tri);
      }
    }

    // Find all boundary edges of the polygonal hole
    const boundaryEdges: Edge[] = [];

    for (const tri of badTriangles) {
      const edges: Edge[] = [
        canonicalEdge(tri.p1, tri.p2),
        canonicalEdge(tri.p2, tri.p3),
        canonicalEdge(tri.p3, tri.p1)
      ];

      for (const e of edges) {
        const idx = boundaryEdges.findIndex(edge => sameEdge(edge, e));
        if (idx === -1) {
          boundaryEdges.push(e);
        } else {
          boundaryEdges.splice(idx, 1);
        }
      }
    }

    // Remove the "bad" triangles
    triangles = triangles.filter(t => !badTriangles.includes(t));

    // Create new triangles that replace the bad triangles removed
    for (const [a, b] of boundaryEdges) {
      triangles.push({ p1: a, p2: b, p3: point });
    }
  }

  // Do last cleanup, removing triangles touching the original supertriangle points
  triangles = triangles.filter(
    t =>
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
  const d = 2 * (a.x * (b.y - c.y) +
                 b.x * (c.y - a.y) +
                 c.x * (a.y - b.y));

  const ux =
    ((a.x ** 2 + a.y ** 2) * (b.y - c.y) +
     (b.x ** 2 + b.y ** 2) * (c.y - a.y) +
     (c.x ** 2 + c.y ** 2) * (a.y - b.y)) / d;

  const uy =
    ((a.x ** 2 + a.y ** 2) * (c.x - b.x) +
     (b.x ** 2 + b.y ** 2) * (a.x - c.x) +
     (c.x ** 2 + c.y ** 2) * (b.x - a.x)) / d;

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
  return (a.x === target.x && a.y === target.y) ||
         (b.x === target.x && b.y === target.y) ||
         (c.x === target.x && c.y === target.y);
}

function manualVoronoi(triangles: Triangle[], start: Point, goal: Point): Edge[] {

  // Find circumcenters of each triangle
  const circumcenters = new Map<Triangle, Point>();

  for (const tri of triangles) {
    const circumcenter = getCircumcenter(tri.p1, tri.p2, tri.p3)
    circumcenters.set(tri, circumcenter)
  }

  // Create adjacenecy for triangles
  const edgeMap = new Map<string, Triangle[]>();
  const vorEdges: Edge[] = [];

  for (const tri of triangles) {
    const edges: Edge[] = [
      [tri.p1, tri.p2],
      [tri.p2, tri.p3],
      [tri.p3, tri.p1]
    ];

    // Add start and goal edges
    if (triangleContains(tri, start)) {
      vorEdges.push([start, circumcenters.get(tri)!])
    }
    if (triangleContains(tri, goal)) {
      vorEdges.push([goal, circumcenters.get(tri)!])
    }

    for (const [a, b] of edges) {
      const key = edgeKey(a, b);

      if (!edgeMap.has(key)) edgeMap.set(key, []);
      edgeMap.get(key)!.push(tri);
    }
  }

  for (const [_, tris] of edgeMap.entries()) {
    if (tris.length === 2) {
      const c1 = circumcenters.get(tris[0]);
      const c2 = circumcenters.get(tris[1]);
      vorEdges.push([c1!, c2!]);
    }
  }

  return vorEdges

}

