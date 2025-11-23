import { useEffect } from 'react';
import Header from './components/Header';
import Timeline from './components/Timeline';
import Canvas from './components/Canvas';
import SidePanel from './components/SidePanel';
import { useStore } from './utils/store';
import { computeVisibilityGraph } from './algorithms/visibilityGraph';
import { computeVoronoi } from './algorithms/voronoiTest';
import type { AlgorithmType } from './utils/types';

const algorithms = {
  visibility: {
    name: 'Visibility Graph',
    algorithm: computeVisibilityGraph,
  },
  voronoi: {
    name: 'Voronoi Diagram',
    algorithm: computeVoronoi,
  },
};

function App() {
  const {
    algorithm,
    startPoint,
    goalPoint,
    polygons,
    canvasSize,
    params,
    setTimelineData,
    setCurrentStep
  } = useStore();

  useEffect(() => {
    if (canvasSize.width === 0 || canvasSize.height === 0) return;

    const selectedAlgo = algorithms[algorithm as AlgorithmType];
    if (!selectedAlgo) return;

    const { steps, phases } = selectedAlgo.algorithm(
      startPoint,
      goalPoint,
      polygons,
      canvasSize,
      params
    );

    setTimelineData(steps, phases);
    setCurrentStep(0);
  }, [
    polygons,
    startPoint,
    goalPoint,
    algorithm,
    canvasSize,
    params,
    setTimelineData,
    setCurrentStep
  ]);

  return (
    <div className="w-full h-screen flex flex-col overflow-hidden">
      <Header />
      <div className="flex-1 flex overflow-hidden relative">
        <SidePanel />
        <Canvas />
      </div>
      <Timeline />
    </div>
  );
}

export default App;