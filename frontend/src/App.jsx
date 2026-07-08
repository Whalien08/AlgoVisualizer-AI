import React, { useState } from "react";
import useAlgorithmNarrator from "./hooks/useAlgorithmNarrator";
import VisualizerPage from "./pages/VisualizerPage";
import AIPage from "./pages/AIPage";
import BenchmarkPage from "./pages/BenchmarkPage";

export default function App() {
  const {
    narrationText,
    currentAction,
    introText,
    isLoading,
    currentStep,
    stepCount,
    isComplete,
    dataArray,
    customInput,
    setCustomInput,
    algorithm,
    setAlgorithm,
    handleApplySettings,
    handleNextStep,
    handlePrevStep,
    handleSeekStep,
    handleJumpToStart,
    handleJumpToEnd,
    handlePlayPause,
    isPlaying,
    hasShownIntro,
    compareIndices,
    swapIndices,
    pivotIndices,
    partitionTree,
  } = useAlgorithmNarrator();

  const [activePage, setActivePage] = useState('visualizer');

  // Snapshot of visualizer state passed into the AI page as live context
  const vizContext = {
    algorithm,
    currentStep,
    stepCount,
    dataArray,
    compareIndices,
    swapIndices,
    pivotIndices,
    narrationText,
  };

  if (activePage === 'ai') {
    return (
      <div className="app-shell">
        <AIPage onBack={() => setActivePage('visualizer')} vizContext={vizContext} />
      </div>
    );
  }

  if (activePage === 'benchmark') {
    return (
      <div className="app-shell">
        <BenchmarkPage onBack={() => setActivePage('visualizer')} />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <VisualizerPage
        narrationText={narrationText}
        currentAction={currentAction}
        introText={introText}
        isLoading={isLoading}
        currentStep={currentStep}
        stepCount={stepCount}
        isComplete={isComplete}
        dataArray={dataArray}
        customInput={customInput}
        setCustomInput={setCustomInput}
        algorithm={algorithm}
        setAlgorithm={setAlgorithm}
        handleApplySettings={handleApplySettings}
        handleNextStep={handleNextStep}
        handlePrevStep={handlePrevStep}
        handleSeekStep={handleSeekStep}
        handleJumpToStart={handleJumpToStart}
        handleJumpToEnd={handleJumpToEnd}
        handlePlayPause={handlePlayPause}
        isPlaying={isPlaying}
        hasShownIntro={hasShownIntro}
        compareIndices={compareIndices}
        swapIndices={swapIndices}
        pivotIndices={pivotIndices}
        partitionTree={partitionTree}
        onOpenAI={() => setActivePage('ai')}
        onOpenBenchmark={() => setActivePage('benchmark')}
      />
    </div>
  );
}
