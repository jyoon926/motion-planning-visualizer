import { MdClose } from 'react-icons/md';

interface Props {
  onClose: () => void;
}

export default function About({ onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-text/30 backdrop-blur-[0.2em] z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 pb-0 flex justify-between items-center sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold">Motion Planning Visualizer</h2>
          <button onClick={onClose} className="p-1 rounded-full duration-300 opacity-50 hover:opacity-80">
            <MdClose className="text-xl" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto">
          <section className="space-y-2 text-text/60">
            <p>
              Motion Planning is the problem of calculating a sequence of valid movements, or a path, for an agent to
              travel from a start point to a goal point while avoiding obstacles.
            </p>
            <p>
              This visualizer helps you understand two fundamental and conceptually different approaches to solving this
              problem by allowing you to draw obstacles and see how each algorithm computes its path step-by-step.
            </p>
          </section>

          <section className="space-y-5">
            <div className="flex-col items-start p-4 bg-text/8 rounded-xl">
              <h4 className="font-bold text-lg">Visibility Graph (Shortest Path)</h4>
              <p className="mt-2 text-text/60">
                This algorithm connects the start/goal points and obstacle vertices to create a graph of all possible
                "visible" paths. The final path is then found using a shortest-path search algorithm like A* Search.
              </p>
              <p className="font-bold mt-2">Goal: Minimum Path Distance (Shortest)</p>
            </div>

            <div className="flex-col items-start p-4 bg-text/8 rounded-xl">
              <h4 className="font-bold text-lg">Voronoi Diagram (Maximum Clearance)</h4>
              <p className="mt-2 text-text/60">
                This method constructs a Voronoi Diagram where all points are equidistant to two or more obstacles. The
                path is constrained to follow the 'skeletal' structure of the free space, effectively maximizing the
                distance (clearance) to all obstacles. This path still finds the shortest path from the start to end,
                but will maximize the clearance on that path.
              </p>
              <p className="font-bold mt-2">Goal: Maximum Obstacle Clearance (Safest)</p>
            </div>

            <div className="flex-col items-start p-4 bg-text/8 rounded-xl">
              <h4 className="font-bold text-lg">Compare Mode</h4>
              <p className="mt-2 text-text/60">
                Select the "Compare" mode to run both algorithms simultaneously and view a direct comparison of the
                final path lengths and the conceptual trade-off between shortest-path and maximum-clearance.
              </p>
            </div>

            <div className="flex justify-between items-end gap-10">
              <div>
                <p>
                  <b>Front-end:</b> Jacob Yoon
                </p>
                <p>
                  <b>Visibility graph implementation:</b> Lydia Klecan
                </p>
                <p>
                  <b>Voronoi path implementation:</b> Tyler Lapiana
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-nowrap px-6 py-2 bg-text text-white font-medium rounded-full shadow hover:bg-text/80 transition-colors"
              >
                Start Visualizing
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
