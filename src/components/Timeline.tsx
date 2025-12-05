import { useCallback, useEffect, useRef, useState } from 'react';
import { MdPause, MdPlayArrow, MdSkipNext, MdSkipPrevious, MdFirstPage, MdLastPage } from 'react-icons/md';
import { useStore } from '../utils/store';

export default function Timeline() {
  const {
    timeline,
    phases,
    currentStep,
    isPlaying,
    fps,
    setCurrentStep,
    setIsPlaying,
    setFps,
    hoveredPhaseId,
    setHoveredPhaseId,
  } = useStore();

  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [scrubberStyle, setScrubberStyle] = useState({ left: '0px', width: '0px' });

  const totalFrames = timeline.length;

  // Scrubber Position Calculation
  useEffect(() => {
    if (!trackRef.current || totalFrames === 0) return;

    const GAP_PX = 4;
    const W_total = trackRef.current.offsetWidth;
    const N_phases = phases.length;

    const W_gaps = Math.max(0, N_phases - 1) * GAP_PX;
    const W_segments = W_total - W_gaps;

    const W_frame_px = W_segments / totalFrames;

    let currentPhaseIndex = 0;
    for (let i = 0; i < N_phases; i++) {
      if (currentStep >= phases[i].startStepIndex && currentStep <= phases[i].endStepIndex) {
        currentPhaseIndex = i;
        break;
      }
    }

    const W_preceding_frames = currentStep * W_frame_px;
    const W_preceding_gaps = currentPhaseIndex * GAP_PX;
    const left_px = W_preceding_frames + W_preceding_gaps;

    setScrubberStyle({
      left: `${left_px}px`,
      width: `${W_frame_px}px`,
    });
  }, [currentStep, totalFrames, phases, isDragging]);

  // Playback Loop
  useEffect(() => {
    if (!isPlaying) return;
    if (currentStep >= totalFrames - 1) {
      setIsPlaying(false);
      return;
    }
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev < totalFrames - 1 ? prev + 1 : prev));
    }, 1000 / fps);
    return () => clearInterval(interval);
  }, [currentStep, fps, totalFrames, isPlaying, setCurrentStep, setIsPlaying]);

  // Click/Drag Logic
  const handleTimelineInteraction = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      if (!trackRef.current || totalFrames === 0) return;
      const rect = trackRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const percentage = x / rect.width;

      const step = Math.max(0, Math.min(totalFrames - 1, Math.floor(percentage * totalFrames)));

      setCurrentStep(step);

      if (isPlaying) setIsPlaying(false);
    },
    [trackRef, totalFrames, isPlaying, setCurrentStep, setIsPlaying]
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleTimelineInteraction(e);
  };

  useEffect(() => {
    const handleUp = () => setIsDragging(false);
    const handleMove = (e: MouseEvent) => {
      if (isDragging) handleTimelineInteraction(e);
    };
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('mousemove', handleMove);
    return () => {
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('mousemove', handleMove);
    };
  }, [isDragging, totalFrames, isPlaying, handleTimelineInteraction]);

  return (
    <div className="disable-selection">
      <div className="w-full h-auto p-4 pt-0 flex flex-col gap-3">
        {/* Current Action Message */}
        <div className="flex justify-between items-end">
          <div className="h-5">
            {timeline.length > 0 && (
              <p className="animate-fade-in">
                <span className="font-bold mr-2">
                  Frame {currentStep + 1} of {totalFrames}:
                </span>
                {timeline[currentStep].message}
              </p>
            )}
          </div>
        </div>

        {/* Custom Segmented Timeline Track */}
        <div
          ref={trackRef}
          className="relative w-full h-6 cursor-pointer group transition-all duration-200"
          onMouseDown={handleMouseDown}
        >
          <div className="absolute inset-0 flex w-full h-full gap-1">
            {phases.map((phase) => {
              const duration = phase.endStepIndex - phase.startStepIndex + 1;
              const widthPct = (duration / totalFrames) * 100;

              return (
                <div
                  key={phase.id}
                  className={`h-full rounded-lg transition-colors duration-200 relative flex justify-center
                    ${phase.id === hoveredPhaseId ? 'bg-black/20' : 'bg-black/10'}
                  `}
                  style={{ width: `${widthPct}%` }}
                  onMouseEnter={() => setHoveredPhaseId(phase.id)}
                  onMouseLeave={() => setHoveredPhaseId(null)}
                >
                  {/* Phase Name Popup */}
                  {phase.id === hoveredPhaseId && (
                    <span className="absolute top-[-32px] text-xs bg-black/70 backdrop-blur text-white px-2 py-1.5 rounded shadow-lg whitespace-nowrap">
                      {phase.name}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Scrubber Knob */}
          <div
            className="absolute top-0 h-full rounded-lg bg-black/20 border-2 border-black shadow-md pointer-events-none z-10"
            style={{
              left: scrubberStyle.left,
              width: scrubberStyle.width,
              transition: 'all 0.1s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            }}
          />
        </div>

        {/* Controls Row */}
        <div className="flex items-center justify-between gap-6">
          <div className="flex flex-1 items-center justify-center gap-2 text-xl">
            {/* Skip to Start */}
            <button onClick={() => setCurrentStep(0)} className="p-2 rounded-full hover:bg-black/10">
              <MdFirstPage />
            </button>

            {/* Previous */}
            <button
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              className="p-2 rounded-full hover:bg-black/10"
            >
              <MdSkipPrevious />
            </button>

            {/* Play / Pause */}
            <button
              className={`p-2 rounded-full font-semibold transition-all ${
                isPlaying ? 'bg-black/10 text-black border-black' : 'bg-black text-white hover:bg-black/80'
              }`}
              onClick={() => {
                if (!isPlaying && currentStep >= totalFrames - 1) setCurrentStep(0);
                setIsPlaying(!isPlaying);
              }}
            >
              {isPlaying ? (
                <>
                  <MdPause />
                </>
              ) : (
                <>
                  <MdPlayArrow />
                </>
              )}
            </button>

            {/* Next */}
            <button
              onClick={() => setCurrentStep(Math.min(totalFrames - 1, currentStep + 1))}
              className="p-2 rounded-full hover:bg-black/10"
            >
              <MdSkipNext />
            </button>

            {/* Skip to End */}
            <button onClick={() => setCurrentStep(totalFrames - 1)} className="p-2 rounded-full hover:bg-black/10">
              <MdLastPage />
            </button>
          </div>

          {/* FPS */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 text-sm text-black/50">
              <label>Animation Speed:</label>
              <input
                type="range"
                min="1"
                max="20"
                value={fps}
                onChange={(e) => setFps(Number(e.target.value))}
                className="w-24 h-1 bg-black/10 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <p className="w-11 text-right">{fps} fps</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
