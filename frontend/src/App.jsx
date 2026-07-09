import React, { useState } from "react";
import useAlgorithmNarrator from "./hooks/useAlgorithmNarrator";
import VisualizerPage from "./pages/VisualizerPage";
import AIPage from "./pages/AIPage";
import BenchmarkPage from "./pages/BenchmarkPage";
import HomePage from './pages/HomePage';
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
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

  //const [activePage, setActivePage] = useState('home');

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
      {location.pathname !== '/' && (
        <nav className="global-nav">
          <button className="btn-secondary" onClick={() => navigate('/')}>🏠 Home</button>
          <button className="btn-secondary" onClick={() => navigate('/visualizer')}>📊 Visualizer</button>
          <button className="btn-secondary" onClick={() => navigate('/benchmark')}>⏱️ Benchmark</button>
          <button className="btn-secondary" onClick={() => navigate('/ai')}>🧠 AI Tutor</button>
        </nav>
      )}
      <Routes>
        <Route path="/" element={<HomePage onNavigate={(page) => navigate(`/${page}`)} />} />
        
        <Route path="/ai" element={<AIPage onBack={() => navigate('/')} vizContext={vizContext} />} />
        
        <Route path="/benchmark" element={<BenchmarkPage onBack={() => navigate('/')} />} />
        
        <Route path="/visualizer" element={
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
            onBack={() => navigate('/')}
            onOpenAI={() => navigate('/ai')}
            onOpenBenchmark={() => navigate('/benchmark')}
          />
        } />
      </Routes>
    </div>
  );
}
