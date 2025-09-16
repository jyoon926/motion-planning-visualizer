import './App.css'
import CanvasComponent from './components/CanvasComponent'
import HeaderComponent from './components/HeaderComponent'

function App() {
  return (
    <div className="absolute inset-0 flex flex-col items-center">
      <HeaderComponent />
      <CanvasComponent />
    </div>
  )
}

export default App
