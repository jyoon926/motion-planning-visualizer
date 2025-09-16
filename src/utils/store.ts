import { create } from 'zustand'
import type { Rectangle, InteractionState, CursorType, DraggablePoint, PointType, Tool, Algorithm } from './types'

const INITIAL_RECTANGLES: Rectangle[] = [
  {
    id: 'rect1',
    center: { x: 300, y: 400 },
    width: 100,
    height: 300,
    rotation: 0,
  },
  {
    id: 'rect2',
    center: { x: 450, y: 300 },
    width: 100,
    height: 300,
    rotation: 0,
  },
  {
    id: 'rect3',
    center: { x: 600, y: 500 },
    width: 100,
    height: 300,
    rotation: 0,
  },
]
const INITIAL_START: DraggablePoint = { id: 'start', center: { x: 100, y: 400 } }
const INITIAL_END: DraggablePoint = { id: 'end', center: { x: 800, y: 400 } }

interface CanvasState {
  rectangles: Rectangle[]
  startPoint: DraggablePoint
  endPoint: DraggablePoint
  hoveredRectId: string | null
  hoveredHandle: string | null
  hoveredPointId: PointType | null
  interaction: InteractionState
  cursor: CursorType
  tool: Tool
  algorithm: Algorithm

  addRectangle: (rect: Rectangle) => void
  updateRectangle: (id: string, updates: Partial<Rectangle>) => void
  deleteRectangle: (id: string) => void
  setHoveredRect: (id: string | null) => void
  setHoveredHandle: (handle: string | null) => void
  setHoveredPoint: (id: PointType | null) => void
  movePoint: (id: PointType, updates: Partial<DraggablePoint>) => void
  setInteraction: (interaction: Partial<InteractionState>) => void
  setCursor: (cursor: CursorType) => void
  clearSelection: () => void
  setTool: (tool: Tool) => void
  setAlgorithm: (algorithm: Algorithm) => void
}

export const useCanvasStore = create<CanvasState>((set) => ({
  rectangles: INITIAL_RECTANGLES,
  startPoint: INITIAL_START,
  endPoint: INITIAL_END,
  hoveredRectId: null,
  hoveredHandle: null,
  hoveredPointId: null,
  interaction: {
    mode: 'idle',
    startPoint: null,
    selectedPointId: null,
    selectedRectId: null,
    dragHandle: null,
  },
  cursor: 'default',
  tool: 'edit',
  algorithm: 'visibilityGraph',

  addRectangle: (rect) =>
    set((state) => ({
      rectangles: [...state.rectangles, rect],
    })),

  updateRectangle: (id, updates) =>
    set((state) => ({
      rectangles: state.rectangles.map((rect) => (rect.id === id ? { ...rect, ...updates } : rect)),
    })),

  deleteRectangle: (id) =>
    set((state) => ({
      rectangles: state.rectangles.filter((rect) => rect.id !== id),
    })),

  setHoveredRect: (id) =>
    set((state) => {
      if (!id) {
        return { hoveredRectId: null }
      }
      const rectIndex = state.rectangles.findIndex((r) => r.id === id)
      if (rectIndex === -1) {
        return { hoveredRectId: id }
      }
      const rect = state.rectangles[rectIndex]
      const newRects = [...state.rectangles.slice(0, rectIndex), ...state.rectangles.slice(rectIndex + 1), rect]
      return {
        hoveredRectId: id,
        rectangles: newRects,
      }
    }),

  setHoveredHandle: (handle) => set({ hoveredHandle: handle }),

  setHoveredPoint: (point) => set({ hoveredPointId: point }),

  movePoint: (id, updates) =>
    set((state) => {
      if (id === 'start') {
        return { startPoint: { ...state.startPoint, ...updates } }
      } else if (id === 'end') {
        return { endPoint: { ...state.endPoint, ...updates } }
      }
      return {}
    }),

  setInteraction: (interaction) =>
    set((state) => ({
      interaction: { ...state.interaction, ...interaction },
    })),

  setCursor: (cursor) => set({ cursor }),

  clearSelection: () =>
    set((state) => ({
      interaction: {
        ...state.interaction,
        selectedRectId: null,
        dragHandle: null,
        mode: 'idle',
      },
      hoveredRectId: null,
      hoveredHandle: null,
      cursor: 'default',
    })),

  setTool: (tool) => set({ tool }),

  setAlgorithm: (algorithm) => set({ algorithm }),
}))
