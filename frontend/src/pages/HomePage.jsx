import React from 'react';

export default function HomePage({ onNavigate }) {
  return (
    <div className="home-page">
      <div className="home-hero">
        <h1>AlgoVisualizer <span className="highlight">AI</span></h1>
        <p className="home-subtitle">
          Master sorting algorithms through interactive visualization, comparative benchmarking, and intelligent AI assistance.
        </p>
      </div>

      <div className="home-grid">
        {/* Card 1: Visualizer */}
        <button className="nav-card" onClick={() => onNavigate('visualizer')}>
          <div className="nav-card-icon">📊</div>
          <div className="nav-card-content">
            <h2>Interactive Visualizer</h2>
            <p>Watch algorithms sort in real-time with step-by-step pseudocode highlights.</p>
          </div>
        </button>

        {/* Card 2: Benchmark */}
        <button className="nav-card" onClick={() => onNavigate('benchmark')}>
          <div className="nav-card-icon">⏱️</div>
          <div className="nav-card-content">
            <h2>Algorithm Benchmark</h2>
            <p>Run two algorithms side-by-side to compare their speed, swaps, and efficiency.</p>
          </div>
        </button>

        {/* Card 3: AI Tutor */}
        <button className="nav-card" onClick={() => onNavigate('ai')}>
          <div className="nav-card-icon">🧠</div>
          <div className="nav-card-content">
            <h2>AI Assistant</h2>
            <p>Ask questions, get explanations, or be quizzed by your personal AI algorithm tutor.</p>
          </div>
        </button>
      </div>
    </div>
  );
}