import type { AlgorithmStep, Point } from '../components/CanvasComponent';

interface StarPoint {
  pnt: Point;
  f: number;
  g: number; 
  h: number;
  parent: Point;
}

function computeVisibilityGraph(start: Point, goal: Point, obstacles: Point[][]): AlgorithmStep[] {
  const timeline: AlgorithmStep[] = [];
  const vertices: Point[] = [];
  const edges: [Point, Point][] = [];
  const path: Point[] = [];

  const update = (message: string) => {
    timeline.push({ message, vertices: [...vertices], edges: [...edges], path: [...path] });
  };

  update('Starting visibility graph computation...');

  // Create visibility graph
  const vgraph: Map<string, Point[]> = new Map<string, Point[]>();

  const ccw = (A: Point, B: Point, C: Point): boolean => (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);

  const segmentsIntersect = (A: Point, B: Point, C: Point, D: Point): boolean =>
    ccw(A, C, D) !== ccw(B, C, D) && ccw(A, B, C) !== ccw(A, B, D);

  const isVisible = (p1: Point, p2: Point): boolean => {
    for (const polygon of obstacles) {
      let selfIntersectionCounter = 0;
      for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i];
        const b = polygon[(i + 1) % polygon.length];
        // Skip if the edge shares an endpoint
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

  update('Starting visibility graph computation...');

  // Add all vertices (iterative for visualization)
  vertices.push(start);
  vgraph.set(getKeyString(start), []);
  update('Added vertex at start point');
  vertices.push(goal);
  vgraph.set(getKeyString(goal), []);
  update('Added vertex at goal point');
  for (const vertex of obstacles.flat()) {
    vertices.push(vertex);
    vgraph.set(getKeyString(vertex), []);
    update(`Added vertex at (${vertex.x}, ${vertex.y})`);
  }

  // Add visible edges
  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 1; j < vertices.length; j++) {
      const v1 = vertices[i];
      const v2 = vertices[j];
      if (isVisible(v1, v2)) {
        edges.push([v1, v2]);
        vgraph.get(getKeyString(v1))?.push(v2);
        vgraph.get(getKeyString(v2))?.push(v1);
        update(`Added edge between (${v1.x}, ${v1.y}) and (${v2.x}, ${v2.y})`);
      }
    }
  }

  // Calculate shortest path with A*
  for (const p of astar(start, goal, vgraph)) {
    console.log(`Pushing (${p.x}, ${p.y}) to path`);
    path.push(p);
  }
  update('Adding path...');

  update('Done!');

  return timeline;
}

// Find the shortest path
function astar(start: Point, goal: Point, vgraph: Map<String, Point[]>): Point[] {
  if (vgraph.size === 2) {
    return [start, goal];
  }

  let open: Map<String, StarPoint> = new Map();
  let closed: Map<String, StarPoint> = new Map();

  open.set(getKeyString(start), {pnt: start, f: 0, parent: start, g: 0, h: heuristic(start, goal)});

  while (open.size > 0){
    // get node in open with lowest f value
    let current = getLowestF(open);
    if (current){
      let currStr = getKeyString(current.pnt);
      console.log("a* current node: ", current.pnt);
      if (current.pnt === goal){
        // return reconstructed path with current node
        console.log("a* found goal, returning path", current);
        return constructPath(current, closed);
      }

      // remove current from open
      open.delete(currStr);
      console.log("a* adding to closed list: ", current);
      closed.set(currStr, current);

      // check all neighboring nodes of current
      let neighbors  = vgraph.get(currStr);
      switch (typeof neighbors){
        case 'undefined':
          console.log("tried to search undefined node: ", current.pnt);
          return [];
        default:
          for (let n = 0; n < neighbors.length; n++){
            let currNeighbor = neighbors[n];
            let neighborStr = getKeyString(currNeighbor);
            console.log("a* testing neighbor: ", currNeighbor);
          // if neighbor not in closed 
            if (!closed.has(neighborStr)){
              // calculate tentative g score
              let tentG = current.g + heuristic(current.pnt, currNeighbor);
              let nInOpen = open.get(neighborStr);
              if (nInOpen){
                // if tentative g < neighbor g, this path is better
                if (tentG < nInOpen.g){
                  nInOpen.parent = current.pnt;
                  nInOpen.g = tentG;
                  nInOpen.h = heuristic(currNeighbor, goal);
                  nInOpen.f = nInOpen.g + nInOpen.h;
                }
              } else { 
                // if neighbor not in open, add to open
                open.set(neighborStr, {
                  pnt: currNeighbor, 
                  f: tentG + heuristic(currNeighbor, goal), 
                  g: tentG, 
                  h: heuristic(currNeighbor, goal), 
                  parent: current.pnt});
              }
            }
          }
      }
    }
  }
  console.log("a* returning empty path");
  return [];
}

// Get unique key string from Point for comparison use
function getKeyString (p: Point): string {
    return `${p.x.toFixed(5)},${p.y.toFixed(5)}`;
}

// Return lowest f value
function getLowestF (open: Map<String, StarPoint>) {
  let lowestF = -1;
  let lowest = null;
  for (const value of open.values()){
    if (lowestF === -1 || value.f < lowestF){
      lowestF = value.f;
      lowest = value;
    }
  }
  return lowest;
}

// Manhattan distance heuristic function
function heuristic (p1: Point, p2: Point): number{
  return Math.abs((p1.x - p2.x)) + Math.abs((p1.y - p2.y));
}

// Construct final path
function constructPath (current: StarPoint, closed: Map<String, StarPoint>) {
  console.log("current map", closed);
  let path: Point[] = [];
  let curr = current;
  while (true){ // can't set to null, so stop when parent = itself
    path.push(curr.pnt);
    console.log("constructPath: pushed curr onto path", curr.pnt);
    if (getKeyString(curr.parent) === getKeyString(curr.pnt)) {
      return path;}
    // set current = current.parent
    let temp = closed.get(getKeyString(curr.parent));
    if (temp){
      curr = temp;
    } else {
      console.log("returned early from path, parent was: ", temp, getKeyString(curr.parent));
      return path;
    }
  }
}

export { computeVisibilityGraph };
