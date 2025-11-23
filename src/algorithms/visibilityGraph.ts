import type { AlgorithmStep, Point } from '../components/CanvasComponent';
import { BinarySearchTree, BinarySearchTreeNode } from './bst';


interface StarPoint {
  pnt: Point;
  f: number;
  g: number;
  h: number;
  parent: Point;
}

interface NodeEdge {
  id: number;
  edge: [Point, Point];
}

function computeVisibilityGraph(
  start: Point,
  goal: Point,
  obstacles: Point[][],
  canvasSize: { width: number; height: number }
): AlgorithmStep[] {
  console.log(canvasSize);
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

  // TESTING
  const orientation = (p: Point, q: Point, r: Point): number => 
    ((q.x * r.y) + (p.x * q.y) + (p.y * r.x)) - ((q.x * p.y) + (r.x * q.y) + (r.y * p.x)); 
  if(vertices.length > 2){
    update(`orientation of start, goal, and (${vertices[2].x}, ${vertices[2].y}) is ${orientation(start, goal, vertices[2])}`);
  }
   // END TESTING
  
  // // Add visible edges
  // for (let p = 0; p < vertices.length; p++){
  //   findVisibleEdges(p, vertices, edges).forEach((edge: [Point, Point]) => {
  //     edges.push(edge)
  //     vgraph.get(getKeyString(edge[0]))?.push(edge[1]);
  //     vgraph.get(getKeyString(edge[1]))?.push(edge[0]);
  //     update(`Added edge between (${edge[0].x}, ${edge[0].y}) and (${edge[1].x}, ${edge[1].y})`);
  //   })

  // }


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
    // console.log(`Pushing (${p.x}, ${p.y}) to path`);
    path.push(p);
  }
  update('Adding path...');

  update('Done!');

  return timeline;
}

/**
 * Find all visible edges from the current point in O(n log n) time
 * @param currP current point
 * @param vertices all vertices
 * @param edges all edges
 * @returns the visible edges
 */
function findVisibleEdges(currP: number, vertices: Point[], edges: [Point, Point][]): [Point, Point][]{
  const currPoint: Point = vertices[currP];
  const visibleEdges : [Point, Point][] = [];

  const idComparator = (a: NodeEdge, b: NodeEdge): number =>{
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  }

  const inOrderIntersection = (
    bst: BinarySearchTree<NodeEdge>, node: BinarySearchTreeNode<NodeEdge> | undefined, 
    wiMinus1: Point, wi: Point
  ): boolean => {
    if (node) {
      inOrderIntersection(bst, node.leftNode, wiMinus1, wi);
      if (segmentsIntersect(node.data.edge[0], node.data.edge[1], wiMinus1, wi)){
        return true;
      }
      inOrderIntersection(bst, node.rightNode, wiMinus1, wi);
    } else {
      return false;
    }
    return false;
  }

  const bst = new BinarySearchTree<NodeEdge>(idComparator);

  const isVisible = (p: Point, w: number): boolean => {
    // TODO if intersects interior of obstacle of which wi is vertex then return false
    if (w === 1 || orientation(p, vertices[w], vertices[w-1]) !== 0){
      if (segmentsIntersect(bst.leftmost(bst.root).edge[0], bst.leftmost(bst.root).edge[1], p, vertices[w])){
        return false;
      } else {
        return true;
      }
    } else {
      if (!isVisible(p, w-1)){
        return false;
      } else {
        // search bst for edge that intersects w-1,w
        if (inOrderIntersection(bst, bst.root, vertices[1-1], vertices[w])){
          return false;
        } else {
          return true;
        }
      }
    }
  };

  const ccw = (A: Point, B: Point, C: Point): boolean => (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);

  const segmentsIntersect = (A: Point, B: Point, C: Point, D: Point): boolean =>
    ccw(A, C, D) !== ccw(B, C, D) && ccw(A, B, C) !== ccw(A, B, D);

  /**
     * Returns the determinant of 3 points in order to find their orientation.
     * @return negative value for negative orientation (clockwise),
     *         positive value for positive orientation (counter-clockwise),
     *         or zero for co-linear points
     */
  // orientaion(p, w/edge.p1, edge.p2): + for clockwise (insert edge), - for ccw(delete edge)
  const orientation = (p: Point, q: Point, r: Point): number => 
    ((q.x * r.y) + (p.x * q.y) + (p.y * r.x)) - ((q.x * p.y) + (r.x * q.y) + (r.y * p.x));
  

  /*
  sort all obstacle vertices according to clockwise angle that the half-line from p to each obstacles makes with the positive x-axis (use code from homework?)
  P is half-line parallel to x-aixs starting at p
  find obstacle Edges that are intersected by P and store in bst in the order of which they are intersected by P
  for each obstacle vertice:
    if Visible, add Wi to list of visible edges
    insert obstacle edges incident to Wi that lie on the clockwise side of the half-line from p to Wi into tree
     delete '' counterclockwise side of half-line from tree

  */

  // sort all obstacle vertices clockwise around p
  const pointAngles: [number, number][] = []
  for (let v = 0; v < vertices.length; v++){
    if (v != currP){
    pointAngles.push([v, Math.atan2(vertices[v].y - currPoint.y, vertices[v].x - currPoint.x)]);
    }
  }
  pointAngles.sort((a, b) => a[1] - b[1]);
  
  // find obstacle edges intersected by P and store in bst
  let idCounter = 0;
  const halfline = [{x:0, y:currPoint.y}, currPoint];
  for (const e of edges){
    if(segmentsIntersect(e[0], e[1], halfline[0], halfline[1])) {
      // todo insert in the order they intersect halfline aka reverse x order (this requires another sort... n log n again)
      bst.insert({id: idCounter, edge: e})
      idCounter++;
    }
  }

  for (const w of pointAngles){
      const wPoint = vertices[w[0]];
      if (isVisible(currPoint, 0)){
        visibleEdges.push([currPoint, wPoint]);
        // insert edges incident to w on clockwise side of half-line
        // delete edges incident to w on counter-clockwise side of half-line
      }
  }

  return visibleEdges;
}


// Find the shortest path
export function astar(start: Point, goal: Point, vgraph: Map<string, Point[]>): Point[] {
  if (vgraph.size === 2) {
    return [start, goal];
  }

  const open: Map<string, StarPoint> = new Map();
  const closed: Map<string, StarPoint> = new Map();

  open.set(getKeyString(start), { pnt: start, f: 0, parent: start, g: 0, h: heuristic(start, goal) });

  while (open.size > 0) {
    // get node in open with lowest f value
    const current = getLowestF(open);
    if (current) {
      const currStr = getKeyString(current.pnt);
      // console.log('a* current node: ', current.pnt);
      if (current.pnt === goal) {
        // return reconstructed path with current node
        // console.log('a* found goal, returning path', current);
        return constructPath(current, closed);
      }

      // remove current from open
      open.delete(currStr);
      // console.log('a* adding to closed list: ', current);
      closed.set(currStr, current);

      // check all neighboring nodes of current
      const neighbors = vgraph.get(currStr);
      switch (typeof neighbors) {
        case 'undefined':
          // console.log('tried to search undefined node: ', current.pnt);
          return [];
        default:
          for (let n = 0; n < neighbors.length; n++) {
            const currNeighbor = neighbors[n];
            const neighborStr = getKeyString(currNeighbor);
            // console.log('a* testing neighbor: ', currNeighbor);
            // if neighbor not in closed
            if (!closed.has(neighborStr)) {
              // calculate tentative g score
              const tentG = current.g + heuristic(current.pnt, currNeighbor);
              const nInOpen = open.get(neighborStr);
              if (nInOpen) {
                // if tentative g < neighbor g, this path is better
                if (tentG < nInOpen.g) {
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
                  parent: current.pnt,
                });
              }
            }
          }
      }
    }
  }
  // console.log('a* returning empty path');
  return [];
}


// Get unique key string from Point for comparison use
export function getKeyString(p: Point): string {
  return `${p.x.toFixed(5)},${p.y.toFixed(5)}`;
}


// Return lowest f value
function getLowestF(open: Map<string, StarPoint>) {
  let lowestF = -1;
  let lowest = null;
  for (const value of open.values()) {
    if (lowestF === -1 || value.f < lowestF) {
      lowestF = value.f;
      lowest = value;
    }
  }
  return lowest;
}


// Manhattan distance heuristic function
function heuristic(p1: Point, p2: Point): number {
  return Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y);
}


// Construct final path
function constructPath(current: StarPoint, closed: Map<string, StarPoint>) {
  // console.log('current map', closed);
  const path: Point[] = [];
  let curr = current;
  while (true) {
    // can't set to null, so stop when parent = itself
    path.push(curr.pnt);
    // console.log('constructPath: pushed curr onto path', curr.pnt);
    if (getKeyString(curr.parent) === getKeyString(curr.pnt)) {
      return path;
    }
    // set current = current.parent
    const temp = closed.get(getKeyString(curr.parent));
    if (temp) {
      curr = temp;
    } else {
      // console.log('returned early from path, parent was: ', temp, getKeyString(curr.parent));
      return path;
    }
  }
}


export { computeVisibilityGraph };
