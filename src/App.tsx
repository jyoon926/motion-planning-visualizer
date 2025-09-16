import './App.css'
import CanvasComponent from './components/CanvasComponent'

function App() {
  return (
    <div className="absolute inset-0 flex flex-col items-center">
      <header className="absolute w-full p-3 pointer-events-none">
        <div className="flex flex-row items-center py-2 px-4 bg-white/50 backdrop-blur rounded-xl pointer-events-auto">
          <h1 className="text-lg w-1/3">Interactive Motion Planning Visualizer</h1>
          <div className="flex flex-row justify-center gap-5 w-1/3">
            <div className="">Draw</div>
            <div className="">Delete</div>
          </div>
        </div>
      </header>
      <CanvasComponent />
    </div>
  )
}

export default App
