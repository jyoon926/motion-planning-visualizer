import type { AlgorithmStep, Point } from '../components/CanvasComponent';

function computeVisibilityGraph(start: Point, goal: Point, obstacles: Point[][]): AlgorithmStep[] {
  const timeline: AlgorithmStep[] = [];
  const vertices: Point[] = [];
  const edges: [Point, Point][] = [];
  const path: Point[] = [];

  const update = (message: string): void => {
    timeline.push({ message, vertices: [...vertices], edges: [...edges], path: [...path] });
  };

  const ccw = (A: Point, B: Point, C: Point): boolean => (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);

  const segmentsIntersect = (A: Point, B: Point, C: Point, D: Point): boolean =>
    ccw(A, C, D) !== ccw(B, C, D) && ccw(A, B, C) !== ccw(A, B, D);

  const isVisible = (p1: Point, p2: Point): boolean => {
    for (const polygon of obstacles) {
      let selfIntersectionCounter = 0
      for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i];
        const b = polygon[(i + 1) % polygon.length];
        // Skip if the edge shares an endpoint
        if (
          (a.x === p1.x && a.y === p1.y) ||
          (b.x === p1.x && b.y === p1.y) ||
          (a.x === p2.x && a.y === p2.y) ||
          (b.x === p2.x && b.y === p2.y)
        ){
          selfIntersectionCounter++
          continue;
        }
        if (segmentsIntersect(p1, p2, a, b)) return false;
      }
      // Check if the line segment is inside the polygon
      if (selfIntersectionCounter > 3) return false
    }
    return true;
  };

  update('Starting visibility graph computation...');

  // Add all vertices (iterative for visualization)
  vertices.push(start);
  update('Added vertex at start point');
  vertices.push(goal);
  update('Added vertex at goal point');
  for (const vertex of obstacles.flat()) {
    vertices.push(vertex);
    update(`Added vertex at (${vertex.x}, ${vertex.y})`);
  }

  // Add visible edges
  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 1; j < vertices.length; j++) {
      const v1 = vertices[i];
      const v2 = vertices[j];
      if (isVisible(v1, v2)) {
        edges.push([v1, v2]);
        update(`Added edge between (${v1.x}, ${v1.y}) and (${v2.x}, ${v2.y})`);
      }
    }
  }

  update('Done!');

  return timeline;
}

export { computeVisibilityGraph };
