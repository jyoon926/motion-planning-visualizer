import { getKeyString } from '../utils/common';
import type { AlgorithmOutput, AlgorithmPhase, AlgorithmStep, Point } from '../utils/types';
import { runAStar } from './astar';
import { BinarySearchTree, BinarySearchTreeNode } from './bst';


interface NodeEdge {
  id: number;
  dist: number;
  edge: [Point, Point];
}

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

  for (let i = 0; i < currentVertices.length; i++) {
    for (let j = i + 1; j < currentVertices.length; j++) {
      const v1 = currentVertices[i];
      const v2 = currentVertices[j];

      addStep(
        phase2Id,
        `Checking visibility between (${Math.round(v1.x)}, ${Math.round(v1.y)}) and (${Math.round(v2.x)}, ${Math.round(v2.y)})`,
        {
          scanLine: [v1, v2],
          activeState: 'checking',
        }
      );

      // TESTING
      // const orientation = (p: Point, q: Point, r: Point): number => 
      //   ((q.x * r.y) + (p.x * q.y) + (p.y * r.x)) - ((q.x * p.y) + (r.x * q.y) + (r.y * p.x)); 
      // if(vertices.length > 2){
      //   update(`orientation of start, goal, and (${vertices[2].x}, ${vertices[2].y}) is ${orientation(start, goal, vertices[2])}`);
      // }
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



      if (isVisible(v1, v2)) {
        currentEdges.push([v1, v2]);
        vgraph.get(getKeyString(v1))?.push(v2);
        vgraph.get(getKeyString(v2))?.push(v1);
       
        addStep(phase2Id, 'Line of sight is clear. Edge added.', {
          activeEdge: [v1, v2],
          activeState: 'valid',
        });
      } else {
        addStep(phase2Id, 'Line of sight blocked by obstacle.', {
          scanLine: [v1, v2],
          activeState: 'invalid',
        });
      }
    }
  }

  phases.push({
    id: phase2Id,
    name: 'Building Visibility Graph',
    description:
      'We construct the edges of the graph by checking the line of sight (LOS) between every pair of vertices. An edge exists if and only if the straight line segment between the two vertices does not intersect any obstacle. The intersection check uses the Counter-Clockwise (CCW) orientation test to determine if two line segments cross.',
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
   


/**
 * Find all visible edges from the current point in O(n log n) time
 * @param currP current point
 * @param vertices all vertices
 * @param edges edges of all obstacles
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

  const distComparator = (a: NodeEdge, b: NodeEdge): number => {
    if (a.dist < b.dist) return -1;
    if (a.dist > b.dist) return 1;
    return 0;
  }

  const calculateIntersection = (edge1: [Point, Point], edge2: Point[]): Point => {
    return {x: 0, y: 0}; //TODO
  }

  const calculateDistance = (p: Point): number =>{
    return Math.sqrt(Math.pow(vertices[currP].x - p.x,2) + Math.pow(vertices[currP].y - p.y,2));
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

  const bst = new BinarySearchTree<NodeEdge>(distComparator);

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
  // orientation(p, w/edge.p1, edge.p2): + for clockwise (insert edge), - for ccw(delete edge)
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
      const intersectionPt = calculateIntersection(e, halfline) // TODO find the intersection of the line segment and they halfline RAY to make things easier
      // TODO insert in the order they intersect halfline aka reverse x order (this requires another sort... n log n again)
      // TODO may need to sort the BST by a different factor than the id so that they stay in this order. not sure how this interacts with things already in the tree
      // Notes: BST needs to be sorted by distance from the center point. 
      //        This will not change as we rotate, unless we pass a special event, but then we will have already removed that one.
      //        Keep a map to quickly access ids via their distance in the tree?
      bst.insert({id: idCounter, edge: e, dist: calculateDistance(intersectionPt)})
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

/*
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
*/
