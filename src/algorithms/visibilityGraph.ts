import type { AlgorithmStep, Point } from '../components/CanvasComponent'

function computeVisibilityGraph(start: Point, goal: Point, obstacles: Point[][]): AlgorithmStep[] {
  const timeline: AlgorithmStep[] = []
  const vertices: Point[] = []
  const edges: [Point, Point][] = []

  const update = (message: string) => {
    timeline.push({ message, vertices: [...vertices], edges: [...edges] })
  }

  update('Starting visibility graph computation...')

  // TODO: Replace with actual visibility graph algorithm

  // Example of using yield to show progress
  for (const vertex of obstacles.flat()) {
    vertices.push(vertex)
    update('Adding vertices...')
  }

  for (const vertex of obstacles.flat()) {
    edges.push([start, vertex], [goal, vertex])
    update('Adding edges...')
  }

  for (const vertex1 of obstacles.flat()) {
    for (const vertex2 of obstacles.flat()) {
      if (vertex1 !== vertex2) {
        edges.push([vertex1, vertex2])
        update('Adding edges...')
      }
    }
  }

  update('Done!')

  return timeline
}

export { computeVisibilityGraph }
