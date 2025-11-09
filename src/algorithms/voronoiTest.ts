import type { AlgorithmStep, Point } from '../components/CanvasComponent';
import { Delaunay } from 'd3-delaunay';
import { astar, getKeyString } from './visibilityGraph';

function computeVoronoi(
  start: Point,
  goal: Point,
  obstacles: Point[][],
  canvasSize: { width: number; height: number }
): AlgorithmStep[] {
  const timeline: AlgorithmStep[] = [];
  const vertices: Point[] = [];
  let edges: [Point, Point][] = [];
  const path: Point[] = [];

  const update = (message: string) => {
    timeline.push({ message, vertices: [...vertices], edges: [...edges], path: [...path] });
  };

  update('Starting Voronoi path computation...');

  const graph: Map<string, Point[]> = new Map();

  // Add start and goal vertices
  vertices.push(start, goal);
  graph.set(getKeyString(start), []);
  graph.set(getKeyString(goal), []);
  update('Added start and goal vertices');

  // Sample points along obstacle edges
  const sampleDistance = 20;
  for (const obstacle of obstacles) {
    for (let i = 0; i < obstacle.length; i++) {
      const a = obstacle[i];
      const b = obstacle[(i + 1) % obstacle.length];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const edgeLength = Math.hypot(dx, dy);
      const numSamples = Math.max(1, Math.ceil(edgeLength / sampleDistance));

      for (let s = 0; s <= numSamples; s++) {
        const t = s / numSamples;
        const samplePoint: Point = {
          x: a.x + t * dx,
          y: a.y + t * dy,
        };
        vertices.push(samplePoint);
        graph.set(getKeyString(samplePoint), []);
        update(`Sampled obstacle point at (${samplePoint.x.toFixed(2)}, ${samplePoint.y.toFixed(2)})`);
      }
    }
  }
  update(`Sampled ${vertices.length - 2} obstacle points`);

  // Sample points along canvas borders
  const { width: canvasWidth, height: canvasHeight } = canvasSize;
  const borderPoints: Point[] = [];

  for (let x = 0; x <= canvasWidth; x += sampleDistance) {
    borderPoints.push({ x, y: 0 }, { x, y: canvasHeight });
  }
  for (let y = sampleDistance; y < canvasHeight; y += sampleDistance) {
    borderPoints.push({ x: 0, y }, { x: canvasWidth, y });
  }

  for (const point of borderPoints) {
    vertices.push(point);
    graph.set(getKeyString(point), []);
    update(`Sampled border point at (${point.x.toFixed(2)}, ${point.y.toFixed(2)})`);
  }
  update(`Sampled ${borderPoints.length} border points`);

  // Compute Voronoi diagram
  const delaunay = Delaunay.from(
    vertices,
    (p: Point) => p.x,
    (p: Point) => p.y
  );
  const voronoi = delaunay.voronoi([0, 0, canvasWidth, canvasHeight]);

  // Extract Voronoi edges
  const edgeSet = new Set<string>();

  for (let i = 0; i < vertices.length; i++) {
    const cell = voronoi.cellPolygon(i);
    if (!cell) continue;

    for (let j = 0; j < cell.length; j++) {
      const p1 = { x: cell[j][0], y: cell[j][1] };
      const p2 = { x: cell[(j + 1) % cell.length][0], y: cell[(j + 1) % cell.length][1] };

      // Use sorted edge key to avoid duplicates
      const key1 = getKeyString(p1);
      const key2 = getKeyString(p2);
      const edgeKey = key1 < key2 ? `${key1}-${key2}` : `${key2}-${key1}`;

      if (!edgeSet.has(edgeKey)) {
        edgeSet.add(edgeKey);
        edges.push([p1, p2]);
        update(
          `Added Voronoi edge between (${p1.x.toFixed(2)}, ${p1.y.toFixed(2)}) and (${p2.x.toFixed(2)}, ${p2.y.toFixed(2)})`
        );
      }
    }
  }

  update(`Computed ${edges.length} unique Voronoi edges`);

  // Connect start and goal to their Voronoi cell vertices
  const connectPointToCell = (point: Point, cellIndex: number) => {
    const cell = voronoi.cellPolygon(cellIndex);
    if (!cell) return;

    const keyPoint = getKeyString(point);
    for (const vertex of cell) {
      const vertexPoint = { x: vertex[0], y: vertex[1] };
      edges.push([point, vertexPoint]);
      update(
        `Connected (${point.x.toFixed(2)}, ${point.y.toFixed(2)}) to Voronoi vertex at (${vertexPoint.x.toFixed(2)}, ${vertexPoint.y.toFixed(2)})`
      );
    }
  };

  connectPointToCell(start, 0);
  connectPointToCell(goal, 1);
  update('Connected start and goal to their Voronoi cell vertices');

  // Check if line segment intersects polygon
  const lineIntersectsPolygon = (p1: Point, p2: Point, polygon: Point[]): boolean => {
    const ccw = (a: Point, b: Point, c: Point) => (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);

    const intersects = (a: Point, b: Point, c: Point, d: Point) =>
      ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d);

    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i];
      const b = polygon[(i + 1) % polygon.length];
      if (intersects(p1, p2, a, b)) return true;
    }
    return false;
  };

  // Filter edges: remove boundary edges and obstacle-intersecting edges
  const isOnBoundary = (p: Point) => p.x <= 0 || p.y <= 0 || p.x >= canvasWidth || p.y >= canvasHeight;
  edges = edges.filter(([p1, p2]) => {
    if (isOnBoundary(p1) || isOnBoundary(p2)) return false;
    return !obstacles.some((obstacle) => lineIntersectsPolygon(p1, p2, obstacle));
  });

  // Build final graph from filtered edges
  graph.clear();
  for (const [p1, p2] of edges) {
    const key1 = getKeyString(p1);
    const key2 = getKeyString(p2);
    if (!graph.has(key1)) graph.set(key1, []);
    if (!graph.has(key2)) graph.set(key2, []);
    graph.get(key1)!.push(p2);
    graph.get(key2)!.push(p1);
  }

  update(`Filtered to ${edges.length} valid edges`);

  // Compute A* path
  const pathPoints = astar(start, goal, graph);
  path.push(...pathPoints);

  update(`Found path with ${path.length} points`);

  return timeline;
}

export { computeVoronoi };
