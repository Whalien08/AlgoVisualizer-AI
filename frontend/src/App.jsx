import React, { useState } from "react";
import useAlgorithmNarrator from "./hooks/useAlgorithmNarrator";
import VisualizerPage from "./pages/VisualizerPage";
import AIPage from "./pages/AIPage";
import BenchmarkPage from "./pages/BenchmarkPage";
import HomePage from './pages/HomePage';

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

  const [activePage, setActivePage] = useState('home');

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

  return (
    <div className="app-shell">
      {activePage !== 'home' && (
        <nav className="global-nav" style={{ marginBottom: '20px', justifyContent: 'center' }}>
          <button className="btn-secondary" onClick={() => setActivePage('home')}>🏠 Home</button>
          <button className="btn-secondary" onClick={() => setActivePage('visualizer')}>📊 Visualizer</button>
          <button className="btn-secondary" onClick={() => setActivePage('benchmark')}>⏱️ Benchmark</button>
          <button className="btn-secondary" onClick={() => setActivePage('ai')}>🧠 AI Tutor</button>
        </nav>
      )}
      {activePage === 'home' && (
        <HomePage onNavigate={(page) => setActivePage(page)} />
      )}

      {activePage === 'ai' && (
        <AIPage onBack={() => setActivePage('home')} vizContext={vizContext} />
      )}

      {activePage === 'benchmark' && (
        <BenchmarkPage onBack={() => setActivePage('home')} />
      )}

      {activePage === 'visualizer' && (
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
        onBack={() => setActivePage('home')}
      />
      )}
    </div>
  );
}
