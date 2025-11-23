import { useStore } from '../utils/store';
import type { AlgorithmType } from '../utils/types';

export default function Header() {
  const { mode, setMode, algorithm, setAlgorithm, setPolygons, setIsComplete, setCurrentPoints } = useStore();

  const handleClear = () => {
    setPolygons([]);
    setCurrentPoints([]);
    setIsComplete(true);
  };

  return (
    <div className="w-full h-14 px-5 flex items-center justify-between border-b border-white/20 bg-white/40 backdrop-blur-md z-30">
      <div className="flex items-center gap-4">
        {/* <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-md shadow-blue-300 shadow-lg">MP</div> */}
        <h1 className="font-bold text-lg text-gray-800 tracking-tight">Motion Planning Visualizer</h1>
      </div>

      <div className="flex gap-4 items-center">
        {/* Tools */}
        <div className="flex bg-gray-100/80 p-1 rounded-lg border border-gray-200">
          <button
            onClick={() => setMode('edit')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer transition-all ${
              mode === 'edit' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Draw
          </button>
          <button
            onClick={() => setMode('delete')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer transition-all ${
              mode === 'delete' ? 'bg-white text-red-500 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Delete
          </button>
        </div>

        <div className="w-px h-6 bg-gray-300 mx-2"></div>

        {/* Algorithm Select */}
        <select
          value={algorithm}
          onChange={(e) => setAlgorithm(e.target.value as AlgorithmType)}
          className="bg-gray-100/80 border-none rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
        >
          <option value="visibility">Visibility Graph</option>
          <option value="voronoi">Voronoi Diagram</option>
        </select>

        <button onClick={handleClear} className="p-1 text-gray-500 cursor-pointer hover:text-red-500 transition-colors">
          Reset
        </button>
      </div>
    </div>
  );
}
