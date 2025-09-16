export interface Point {
  x: number
  y: number
}

export interface Rectangle {
  id: string
  center: Point
  width: number
  height: number
  rotation: number // in degrees
}

export interface DraggablePoint {
  id: 'start' | 'end'
  center: Point
}

export type CursorType = 'default' | 'crosshair' | 'pointer' | 'grab'

export type InteractionMode = 'drawing' | 'moving' | 'resizing' | 'rotating' | 'idle'

export interface InteractionState {
  mode: InteractionMode
  startPoint: Point | null
  selectedPointId: 'start' | 'end' | null
  selectedRectId: string | null
  dragHandle: string | null // 'body', 'top', 'right', 'bottom', 'left', 'nw', 'ne', 'sw', 'se'
}
