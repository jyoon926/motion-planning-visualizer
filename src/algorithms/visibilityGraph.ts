import type { AlgorithmStep, Point } from '../components/CanvasComponent'

function computeVisibilityGraph(start: Point, goal: Point, obstacles: Point[][]): AlgorithmStep[] {
  const timeline: AlgorithmStep[] = []
  const vertices: Point[] = []
  const edges: [Point, Point][] = []
  const path: Point[] = []

  const update = (message: string) => {
    timeline.push({ message, vertices: [...vertices], edges: [...edges], path: [...path] })
  }

  update('Starting visibility graph computation...')

  // Create visibility graph

  for (const vertex of obstacles.flat()) {
    vertices.push(vertex)
    update('Adding vertices...')
  }

  // Check for intersections with start and goal points
  for (const vertex of obstacles.flat()){
    for (const polygon of obstacles) {
      let add_start = true
      let add_goal = true
      let segment: [Point, Point] = [polygon[obstacles.length-1], polygon[0]]
      if (intersects([start, vertex], segment)){
        add_start = false
      }
      if (intersects([goal, vertex], segment,)){
        add_goal = false
      }
      for (let i = 0; i < polygon.length-1; i++){
        segment = [polygon[i], polygon[i+1]]
        if (intersects([start, vertex], segment)){
          add_start = false
        }
        if (intersects([goal, vertex], segment,)){
          add_goal = false
        } 
      }

      if (add_start) {
        edges.push([start, vertex])
      }
      if (add_goal) {
        edges.push([goal, vertex])
      }
      update('Adding edges...')
    }
  }



  // Example of using yield to show progress
  // for (const vertex of obstacles.flat()) {
  //   vertices.push(vertex)
  //   update('Adding vertices...')
  // }

  // for (const vertex of obstacles.flat()) {
  //   edges.push([start, vertex], [goal, vertex])
  //   update('Adding edges...')
  // }

  // for (const vertex1 of obstacles.flat()) {
  //   for (const vertex2 of obstacles.flat()) {
  //     if (vertex1 !== vertex2) {
  //       edges.push([vertex1, vertex2])
  //       update('Adding edges...')
  //     }
  //   }
  // }

  // path.push(start, goal)
  // update('Adding path...')

  // update('Done!')

  return timeline
}

// Determine if line segments intersect
function intersects(lineOne: [Point, Point], lineTwo: [Point, Point]): boolean {
  const p = lineOne[0]
  const p2 = lineOne[1]
  const q = lineTwo[0]
  const q2 = lineTwo[1]

  // Points are overlapping, not an intersection
  if (p === q || p === q2 || p2 === q || p2 === q2) {
    return false;
  }

  const r = {x: p2.x - p.x, y: p2.y - p.y}
  const s = {x: q2.x - q.x, y: q2.y - q.y}

  const denom = r.x * s.y - r.y * s.x

  // Lines are parallel or collinear
  if (denom === 0) return false

  const t = ((q.x - p.x) * s.y - (q.y - p.y) * s.x) / denom
  const u = ((q.x - p.x) * r.y - (q.y - p.y) * r.x) / denom

  // Check if intersection occurs within both line segments
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return true
  }

  // Intersection is outside of the segments
  return false
}

export { computeVisibilityGraph }
