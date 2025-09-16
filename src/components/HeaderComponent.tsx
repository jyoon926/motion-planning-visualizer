import { useCanvasStore } from '../utils/store'

function HeaderComponent() {
  const { tool, algorithm, setTool, setAlgorithm } = useCanvasStore()

  return (
    <>
      <div className="absolute top-2 left-2 bg-white/80 py-2 px-5 backdrop-blur rounded-full shadow-md">
        Interactive Motion Planning Visualizer
      </div>
      <header className="absolute w-full flex flex-row justify-center p-2 pointer-events-none">
        <div className="flex flex-row items-center gap-1 p-1 bg-white/80 backdrop-blur rounded-full shadow-md pointer-events-auto">
          <button
            className={`py-1 px-4 rounded-full duration-300 cursor-pointer ${tool === 'edit' ? 'inset-shadow-sm inset-shadow-black/10 bg-black/15' : 'hover:bg-black/10'}`}
            onClick={() => setTool('edit')}
          >
            Edit
          </button>
          <button
            className={`py-1 px-4 rounded-full duration-300 cursor-pointer ${tool === 'delete' ? 'inset-shadow-sm inset-shadow-black/10 bg-black/15' : 'hover:bg-black/10'}`}
            onClick={() => setTool('delete')}
          >
            Delete
          </button>
        </div>
      </header>
      <div className="absolute top-2 right-2 flex flex-row items-center gap-2">
        <div className="flex flex-row items-center gap-1 bg-white/80 p-1 backdrop-blur rounded-full shadow-md">
          <button
            className={`py-1 px-4 rounded-full duration-300 cursor-pointer ${algorithm === 'visibilityGraph' ? 'inset-shadow-sm inset-shadow-black/10 bg-black/15' : 'hover:bg-black/10'}`}
            onClick={() => setAlgorithm('visibilityGraph')}
          >
            Visibility Graph
          </button>
          <button
            className={`py-1 px-4 rounded-full duration-300 cursor-pointer ${algorithm === 'voronoi' ? 'inset-shadow-sm inset-shadow-black/10 bg-black/15' : 'hover:bg-black/10'}`}
            onClick={() => setAlgorithm('voronoi')}
          >
            Voronoi
          </button>
        </div>
        <button className="py-2 px-5 rounded-full bg-black/80 backdrop-blur shadow-md text-white cursor-pointer">
          Generate Path
        </button>
      </div>
    </>
  )
}

export default HeaderComponent
