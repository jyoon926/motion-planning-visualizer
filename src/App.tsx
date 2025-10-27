import './App.css';
import CanvasComponent from './components/CanvasComponent';
import SidePanelComponent from './components/SidePanelComponent';

function App() {
  return (
    <div className="absolute inset-0 flex flex-row items-center bg-gray-200">
      <div className="w-full h-full flex flex-col">
        <CanvasComponent />
      </div>
      <SidePanelComponent />
    </div>
  );
}

export default App;
