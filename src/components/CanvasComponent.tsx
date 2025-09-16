import { useCallback, useEffect, useRef, useState } from 'react'
import type { CursorType, DraggablePoint, Point, PointType, Rectangle } from '../utils/types'
import { useCanvasStore } from '../utils/store'

const HANDLE_SIZE = 8
const ROTATE_HANDLE_OFFSET = 30
const COLOR_BACKGROUND = '#d0d0d0'
const COLOR_RECTANGLE_FILL = '#f5f5f5'
const COLOR_RECTANGLE_STROKE = '#444'
const COLOR_RECTANGLE_STROKE_HOVERED = '#000'
const COLOR_RECTANGLE_DELETE_HOVERED = '#dc2626' // Red color for delete mode
const STROKE_WIDTH = 1.5
const POINT_RADIUS = 12

function CanvasComponent() {
  const {
    rectangles,
    startPoint,
    endPoint,
    hoveredRectId,
    hoveredHandle,
    hoveredPointId,
    interaction,
    cursor,
    tool,
    addRectangle,
    updateRectangle,
    deleteRectangle,
    setInteraction,
    movePoint,
    setCursor,
    setHoveredRect,
    setHoveredHandle,
    setHoveredPoint,
  } = useCanvasStore()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDrawingRef = useRef(false)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })

  // Update canvas dimensions when container resizes
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { offsetWidth, offsetHeight } = containerRef.current
        setDimensions({ width: offsetWidth, height: offsetHeight })
      }
    }
    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  // Get mouse position relative to canvas
  const getMousePosition = useCallback((e: React.MouseEvent<HTMLCanvasElement>): Point => {
    if (!canvasRef.current) return { x: 0, y: 0 }
    const rect = canvasRef.current.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }, [])

  // Hit test for start/end points
  const getPointHitTest = useCallback(
    (mousePos: Point): PointType | null => {
      const radius = 10
      const dist = (p: { x: number; y: number }) => Math.hypot(mousePos.x - p.x, mousePos.y - p.y)

      if (dist(startPoint.center) <= radius) return 'start'
      if (dist(endPoint.center) <= radius) return 'end'
      return null
    },
    [startPoint, endPoint]
  )

  // Hit test for rectangles and their handles
  const getRectHitTest = useCallback(
    (mousePos: Point): { rectId: string | null; handle: string | null } => {
      for (let i = rectangles.length - 1; i >= 0; i--) {
        const rect = rectangles[i]

        const angle = (-rect.rotation * Math.PI) / 180
        const dx = mousePos.x - rect.center.x
        const dy = mousePos.y - rect.center.y
        const localX = dx * Math.cos(angle) - dy * Math.sin(angle) + rect.width / 2
        const localY = dx * Math.sin(angle) + dy * Math.cos(angle) + rect.height / 2

        // Rotation handle
        const rotateLocalX = rect.width / 2
        const rotateLocalY = -ROTATE_HANDLE_OFFSET
        if (
          Math.abs(localX - rotateLocalX) <= HANDLE_SIZE / 2 + 2 &&
          Math.abs(localY - rotateLocalY) <= HANDLE_SIZE / 2 + 2
        ) {
          return { rectId: rect.id, handle: 'rotate' }
        }

        if (
          localX >= -HANDLE_SIZE &&
          localX <= rect.width + HANDLE_SIZE &&
          localY >= -HANDLE_SIZE &&
          localY <= rect.height + HANDLE_SIZE
        ) {
          const handles = [
            { id: 'nw', x: 0, y: 0 },
            { id: 'ne', x: rect.width, y: 0 },
            { id: 'sw', x: 0, y: rect.height },
            { id: 'se', x: rect.width, y: rect.height },
            { id: 'top', x: rect.width / 2, y: 0 },
            { id: 'right', x: rect.width, y: rect.height / 2 },
            { id: 'bottom', x: rect.width / 2, y: rect.height },
            { id: 'left', x: 0, y: rect.height / 2 },
          ]

          for (const handle of handles) {
            if (Math.abs(localX - handle.x) <= HANDLE_SIZE && Math.abs(localY - handle.y) <= HANDLE_SIZE) {
              return { rectId: rect.id, handle: handle.id }
            }
          }

          if (localX >= 0 && localX <= rect.width && localY >= 0 && localY <= rect.height) {
            return { rectId: rect.id, handle: 'body' }
          }
        }
      }
      return { rectId: null, handle: null }
    },
    [rectangles]
  )

  // Handle mouse down
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const mousePos = getMousePosition(e)

      // Delete tool behavior
      if (tool === 'delete') {
        const hitTest = getRectHitTest(mousePos)
        if (hitTest.rectId) {
          deleteRectangle(hitTest.rectId)
          setHoveredRect(null)
          setHoveredHandle(null)
        }
        return
      }

      // Edit tool behavior (original functionality)
      if (tool === 'edit') {
        // Check if clicked on start/end point
        const pointHit = getPointHitTest(mousePos)
        if (pointHit) {
          setInteraction({
            mode: 'moving',
            startPoint: mousePos,
            selectedPointId: pointHit,
            selectedRectId: null,
          })
          return
        }

        // Check if clicked on a rectangle or its handle
        if (hoveredRectId && hoveredHandle) {
          setInteraction({
            mode: hoveredHandle === 'body' ? 'moving' : hoveredHandle === 'rotate' ? 'rotating' : 'resizing',
            startPoint: mousePos,
            selectedRectId: hoveredRectId,
            dragHandle: hoveredHandle,
          })
          return
        }

        // Otherwise, start drawing a new rectangle
        isDrawingRef.current = true
        const newRect: Rectangle = {
          id: generateId(),
          center: { x: mousePos.x, y: mousePos.y },
          width: 0,
          height: 0,
          rotation: 0,
        }
        addRectangle(newRect)
        setInteraction({
          mode: 'drawing',
          startPoint: mousePos,
          selectedRectId: newRect.id,
          dragHandle: null,
        })
      }
    },
    [
      tool,
      hoveredRectId,
      hoveredHandle,
      addRectangle,
      deleteRectangle,
      setInteraction,
      setHoveredRect,
      setHoveredHandle,
      getMousePosition,
      getPointHitTest,
      getRectHitTest,
    ]
  )

  // Handle mouse move
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const mousePos = getMousePosition(e)

      // Update hover state when idle
      if (interaction.mode === 'idle') {
        // Delete tool behavior - only hover rectangles, simpler cursor
        if (tool === 'delete') {
          const hitTest = getRectHitTest(mousePos)
          setHoveredRect(hitTest.rectId)
          setHoveredHandle(null) // Don't show handles in delete mode
          setHoveredPoint(null)
          setCursor(hitTest.rectId ? 'pointer' : 'default')
          return
        }

        // Edit tool behavior (original functionality)
        if (tool === 'edit') {
          // Check if hovering over start/end point
          const pointHit = getPointHitTest(mousePos)
          if (pointHit) {
            setHoveredRect(null)
            setHoveredHandle(null)
            setHoveredPoint(pointHit)
            setCursor('grab')
            return
          }

          // Check if hovering over a rectangle or its handle
          const hitTest = getRectHitTest(mousePos)
          setHoveredRect(hitTest.rectId)
          setHoveredHandle(hitTest.handle)
          setHoveredPoint(null)
          setCursor(hitTest.handle ? getCursorForHandle(hitTest.handle) : 'crosshair')
          return
        }
      }

      if (!interaction.startPoint || !(interaction.selectedRectId || interaction.selectedPointId)) return

      const rect = rectangles.find((r) => r.id === interaction.selectedRectId)!

      const dx = mousePos.x - interaction.startPoint.x
      const dy = mousePos.y - interaction.startPoint.y

      switch (interaction.mode) {
        case 'drawing':
          updateRectangle(rect!.id, {
            width: Math.abs(dx),
            height: Math.abs(dy),
            center: {
              x: interaction.startPoint.x + dx / 2,
              y: interaction.startPoint.y + dy / 2,
            },
          })
          break

        case 'moving':
          if (interaction.selectedPointId) {
            movePoint(interaction.selectedPointId, {
              center: {
                x: mousePos.x,
                y: mousePos.y,
              },
            })
          } else if (rect) {
            updateRectangle(rect.id, {
              center: {
                x: rect.center.x + dx,
                y: rect.center.y + dy,
              },
            })
          }
          setInteraction({ startPoint: mousePos })
          break

        case 'resizing': {
          let newCX = rect.center.x
          let newCY = rect.center.y
          let newW = rect.width
          let newH = rect.height
          const projW = dx * Math.cos(rect.rotation * (Math.PI / 180)) + dy * Math.sin(rect.rotation * (Math.PI / 180))
          const projH =
            dx * Math.cos((rect.rotation + 90) * (Math.PI / 180)) +
            dy * Math.sin((rect.rotation + 90) * (Math.PI / 180))
          const shiftXW = (projW / 2) * Math.cos(rect.rotation * (Math.PI / 180))
          const shiftYW = (projW / 2) * Math.sin(rect.rotation * (Math.PI / 180))
          const shiftXH = (projH / 2) * Math.cos((rect.rotation + 90) * (Math.PI / 180))
          const shiftYH = (projH / 2) * Math.sin((rect.rotation + 90) * (Math.PI / 180))

          switch (interaction.dragHandle) {
            case 'right':
            case 'ne':
            case 'se':
              newW = rect.width + projW
              newCX += shiftXW
              newCY += shiftYW
              break
            case 'left':
            case 'nw':
            case 'sw':
              newW = rect.width - projW
              newCX += shiftXW
              newCY += shiftYW
              break
          }
          switch (interaction.dragHandle) {
            case 'bottom':
            case 'se':
            case 'sw':
              newH = rect.height + projH
              newCX += shiftXH
              newCY += shiftYH
              break
            case 'top':
            case 'ne':
            case 'nw':
              newH = rect.height - projH
              newCX += shiftXH
              newCY += shiftYH
              break
          }

          updateRectangle(rect.id, {
            center: { x: newCX, y: newCY },
            width: Math.max(10, newW),
            height: Math.max(10, newH),
          })
          setInteraction({ startPoint: mousePos })
          break
        }

        case 'rotating': {
          const angle = (Math.atan2(mousePos.y - rect.center.y, mousePos.x - rect.center.x) * 180) / Math.PI
          updateRectangle(rect.id, { rotation: angle + 90 })
          break
        }
      }
    },
    [
      tool,
      interaction,
      rectangles,
      updateRectangle,
      setInteraction,
      setHoveredRect,
      setHoveredHandle,
      setHoveredPoint,
      setCursor,
      getPointHitTest,
      getRectHitTest,
      getMousePosition,
      movePoint,
    ]
  )

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    if (isDrawingRef.current) {
      isDrawingRef.current = false
    }
    setInteraction({
      mode: 'idle',
      dragHandle: null,
      startPoint: null,
      selectedRectId: null,
      selectedPointId: null,
    })
  }, [setInteraction])

  // Draw function
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw background
    ctx.fillStyle = COLOR_BACKGROUND
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw rectangles
    rectangles.forEach((rect) => {
      const isHovered = hoveredRectId === rect.id
      drawRectangle(ctx, rect, isHovered)
    })

    // Draw start/end points
    drawPoint(ctx, startPoint)
    drawPoint(ctx, endPoint)
  }, [startPoint, endPoint, rectangles, hoveredRectId, hoveredPointId, tool])

  // Draw a single rectangle
  const drawRectangle = (ctx: CanvasRenderingContext2D, rect: Rectangle, isHovered: boolean) => {
    ctx.save()

    // Translate to rectangle center for rotation
    ctx.translate(rect.center.x, rect.center.y)
    ctx.rotate((rect.rotation * Math.PI) / 180)

    // Draw rectangle from center
    const x = -rect.width / 2
    const y = -rect.height / 2

    // Fill
    ctx.fillStyle = COLOR_RECTANGLE_FILL
    ctx.fillRect(x, y, rect.width, rect.height)

    // Stroke - use red color if hovered in delete mode
    const isDeleteMode = tool === 'delete'
    ctx.strokeStyle = isHovered
      ? isDeleteMode
        ? COLOR_RECTANGLE_DELETE_HOVERED
        : COLOR_RECTANGLE_STROKE_HOVERED
      : COLOR_RECTANGLE_STROKE
    ctx.lineWidth = isHovered && isDeleteMode ? 2 : STROKE_WIDTH
    ctx.strokeRect(x, y, rect.width, rect.height)

    // Draw handles only if hovered and in edit mode
    if (isHovered && tool === 'edit') {
      const handles = [
        { id: 'nw', x: x, y: y },
        { id: 'ne', x: x + rect.width, y: y },
        { id: 'sw', x: x, y: y + rect.height },
        { id: 'se', x: x + rect.width, y: y + rect.height },
        { id: 'top', x: x + rect.width / 2, y: y },
        { id: 'right', x: x + rect.width, y: y + rect.height / 2 },
        { id: 'bottom', x: x + rect.width / 2, y: y + rect.height },
        { id: 'left', x: x, y: y + rect.height / 2 },
      ]

      handles.forEach((handle) => {
        ctx.fillStyle = COLOR_RECTANGLE_FILL
        ctx.fillRect(handle.x - HANDLE_SIZE / 2, handle.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE)
        ctx.strokeStyle = COLOR_RECTANGLE_STROKE_HOVERED
        ctx.lineWidth = STROKE_WIDTH
        ctx.strokeRect(handle.x - HANDLE_SIZE / 2, handle.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE)
      })

      // Rotation handle above top center
      const rotateX = x + rect.width / 2
      const rotateY = y - ROTATE_HANDLE_OFFSET
      ctx.beginPath()
      ctx.arc(rotateX, rotateY, HANDLE_SIZE / 2 + 2, 0, Math.PI * 2)
      ctx.fillStyle = COLOR_RECTANGLE_FILL
      ctx.fill()
      ctx.strokeStyle = COLOR_RECTANGLE_STROKE_HOVERED
      ctx.lineWidth = STROKE_WIDTH
      ctx.stroke()

      // Draw line connecting top-center handle to rotation handle
      ctx.beginPath()
      ctx.moveTo(rotateX, y - HANDLE_SIZE / 2) // top-center handle
      ctx.lineTo(rotateX, rotateY + HANDLE_SIZE / 2 + 2) // rotation handle
      ctx.strokeStyle = COLOR_RECTANGLE_STROKE_HOVERED
      ctx.lineWidth = STROKE_WIDTH
      ctx.stroke()
    }

    ctx.restore()
  }

  const drawPoint = (ctx: CanvasRenderingContext2D, point: DraggablePoint) => {
    ctx.beginPath()
    ctx.arc(point.center.x, point.center.y, POINT_RADIUS, 0, Math.PI * 2)
    ctx.fillStyle = point.id === startPoint.id ? 'green' : 'red'
    ctx.fill()
    ctx.strokeStyle = hoveredPointId === point.id ? COLOR_RECTANGLE_STROKE_HOVERED : COLOR_RECTANGLE_STROKE
    ctx.lineWidth = STROKE_WIDTH
    ctx.stroke()
  }

  // Redraw when state changes
  useEffect(() => {
    draw()
  }, [dimensions, draw])

  const getCursorForHandle = (handle: string): CursorType => {
    const cursorMap: { [key: string]: CursorType } = {
      body: 'grab',
      nw: 'pointer',
      ne: 'pointer',
      sw: 'pointer',
      se: 'pointer',
      top: 'pointer',
      right: 'pointer',
      bottom: 'pointer',
      left: 'pointer',
      rotate: 'pointer',
    }
    return cursorMap[handle] || 'default'
  }

  const generateId = () => Math.random().toString(36)

  return (
    <div className="w-full h-full" ref={containerRef}>
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        style={{ cursor }}
      />
    </div>
  )
}

export default CanvasComponent
