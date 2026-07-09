import React from 'react';
import PseudocodePane from '../components/PseudocodePane';

// ── Partition-tree SVG layout ─────────────────────────────────────────────
// Constants that control spacing (px).
const NODE_W = 160;   // node box width
const NODE_H = 80;    // node box height (approximate; text wraps inside)
const H_GAP  = 28;    // horizontal gap between sibling subtrees
const V_GAP  = 56;    // vertical gap between a parent bottom and child top

/**
 * Measure phase — returns a layout node with:
 *   x      : centre x of this node relative to the subtree's own left edge
 *   width  : total pixel width of the subtree (including children)
 *   depth  : depth from root (0-based), used to compute y
 *   node   : original data node
 *   kids   : laid-out children
 */
function measure(node, depth = 0) {
  if (!node) return null;
  const children = (node.children || []).filter(Boolean).map(c => measure(c, depth + 1));

  let width;
  let x;

  if (children.length === 0) {
    width = NODE_W;
    x = NODE_W / 2;
  } else {
    // Total width = sum of children widths + gaps between them
    const totalKidW = children.reduce((s, k) => s + k.width, 0);
    width = totalKidW + H_GAP * (children.length - 1);
    // Centre x = midpoint of leftmost child centre and rightmost child centre
    // (which equals half of total width once we position them below)
    x = width / 2;
  }

  return { node, depth, x, width, kids: children };
}

/**
 * Position phase — walk the measured tree and assign absolute (cx, cy) to
 * every node, where cx/cy are the centre coordinates of the node box.
 * offsetX is the absolute x of this subtree's left edge.
 */
function position(laid, offsetX = 0) {
  const cx = offsetX + laid.x;
  const cy = laid.depth * (NODE_H + V_GAP) + NODE_H / 2;

  let childOffset = offsetX;
  const positionedKids = laid.kids.map(k => {
    const pk = position(k, childOffset);
    childOffset += k.width + H_GAP;
    return pk;
  });

  return { ...laid, cx, cy, kids: positionedKids };
}

/**
 * Flatten the positioned tree into two arrays:
 *   nodes  : { key, cx, cy, node }
 *   edges  : { x1, y1, x2, y2 }  (parent-bottom → child-top)
 */
function flatten(ptree, nodes = [], edges = []) {
  nodes.push({ key: ptree.node.label + '_' + ptree.cx, cx: ptree.cx, cy: ptree.cy, node: ptree.node });
  for (const kid of ptree.kids) {
    edges.push({
      x1: ptree.cx,
      y1: ptree.cy + NODE_H / 2,        // parent bottom
      x2: kid.cx,
      y2: kid.cy - NODE_H / 2,          // child top
    });
    flatten(kid, nodes, edges);
  }
  return { nodes, edges };
}

/** Build an SVG elbow path: drop vertically to midpoint, step horizontally, drop to child. */
function elbowPath(x1, y1, x2, y2) {
  const midY = (y1 + y2) / 2;
  return `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
}

/** Top-level: take raw tree data, return everything needed to render. */
function layoutTree(root) {
  if (!root) return null;
  const measured  = measure(root);
  const posed     = position(measured, 0);
  const { nodes, edges } = flatten(posed);

  // SVG canvas size
  const svgW = measured.width;
  const depth = Math.max(...nodes.map(n => n.cy)) + NODE_H / 2;
  const svgH  = depth;

  return { nodes, edges, svgW, svgH };
}

// ── Component ─────────────────────────────────────────────────────────────

export default function VisualizerPage({
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
  onOpenAI,
  onOpenBenchmark,
  onBack,
}) {
  const renderPartitionTree = (root) => {
    const layout = layoutTree(root);
    if (!layout) return null;
    const { nodes, edges, svgW, svgH } = layout;

    return (
      <div className="partition-svg-wrap" style={{ width: svgW, height: svgH, position: 'relative' }}>
        {/* SVG connector lines — rendered first so they sit behind the nodes */}
        <svg
          className="partition-svg"
          width={svgW}
          height={svgH}
          style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible', pointerEvents: 'none' }}
        >
          {edges.map((e, i) => (
            <path
              key={i}
              d={elbowPath(e.x1, e.y1, e.x2, e.y2)}
              fill="none"
              stroke="rgba(79,70,229,0.35)"
              strokeWidth={1.5}
              strokeLinecap="round"
            />
          ))}
        </svg>

        {/* Node boxes — absolutely positioned over the SVG */}
        {nodes.map(({ key, cx, cy, node }) => (
          <div
            key={key}
            className="partition-node"
            style={{
              position: 'absolute',
              left: cx - NODE_W / 2,
              top:  cy - NODE_H / 2,
              width: NODE_W,
              minHeight: NODE_H,
            }}
          >
            <div className="partition-node-label">{node.label || 'Partition'}</div>
            {node.operation && <div className="partition-node-operation">{node.operation}</div>}
            {node.message && <div className="partition-node-message">{node.message}</div>}
            <div className="partition-values">
              {(node.values || []).map((v, i) => (
                <span key={i} className="partition-value">{v}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const treeAlgos = ['merge sort', '3-way merge sort', 'quick sort'];
  const visiblePartitionTree = treeAlgos.includes(algorithm?.toLowerCase()) ? partitionTree : null;

  // Transport bar derived state
  const hasSteps = hasShownIntro && stepCount > 0;
  const atStart = currentStep === 0;
  const atEnd = isComplete;
  const sliderMax = stepCount > 1 ? stepCount - 1 : 1;

  const playLabel = isLoading ? '⏳' : isPlaying ? '⏸' : hasShownIntro ? '▶' : '▶ Start';

  return (
    <>
      <div className="page-header">
          <div>
            <h1>Algorithmic Visualizer AI</h1>
            <p className="page-subtitle">Study each sorting step with highlights and a separate AI workspace.</p>
          </div>
          <button className="chat-toggle" onClick={onBack}>← Back</button>
      </div>

      <div className="control-stack">
        <div>
          <label htmlFor="algorithm-select">Algorithm: </label>
          <select id="algorithm-select" className="drop-down" value={algorithm} onChange={(e) => setAlgorithm(e.target.value)}>
            <option>Bubble Sort</option>
            <option>Selection Sort</option>
            <option>Insertion Sort</option>
            <option>Merge Sort</option>
            <option>Quick Sort</option>
            <option>Heap Sort</option>
            <option>3-way Merge Sort</option>
            <option>Cycle Sort</option>
          </select>
        </div>

        <div>
          <label htmlFor="array-input">Data Array (comma separated): </label>
          <input
            id="array-input"
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleApplySettings()}
            className="array-text-input"
            placeholder="e.g. 12, 45, 23, 7, 50"
          />
          <button className="btn-secondary" onClick={handleApplySettings}>
            Apply
          </button>
        </div>
      </div>

      <div className={`viz-layout-container ${visiblePartitionTree ? 'has-tree' : 'no-tree'}`}>
        <div className="viz-visuals-section">
          <div className="array-container">
            {dataArray.map((num, i) => {
              const isCompared = compareIndices.includes(i);
              const isSwapped = swapIndices.includes(i);
              const isPivot = pivotIndices.includes(i);
              return (
                <div key={i} className="array-item">
                  <div className={`array-card ${isCompared ? 'compare' : ''} ${isSwapped ? 'swap' : ''} ${isPivot ? 'pivot' : ''}`}>
                    {num}
                  </div>
                  {isCompared && (
                    <div className="compare-annotation">
                      <div className="compare-line" />
                      <span className="compare-label">Compared</span>
                    </div>
                  )}
                  {isPivot && (
                    <div className="pivot-annotation">
                      <div className="pivot-line" />
                      <span className="pivot-label">Pivot</span>
                    </div>
                  )}
                  {isSwapped && (
                    <div className="swap-annotation">
                      <div className="swap-line" />
                      <span className="swap-label">Swapped</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {visiblePartitionTree && (
            <div className="partition-tree">
              <div className="partition-tree-title">Partition view</div>
              {renderPartitionTree(visiblePartitionTree)}
            </div>
          )}
        </div>

        <div className="viz-code-section">
            <PseudocodePane
              algorithm={algorithm}
              action={currentAction}
              hasStarted={hasShownIntro}
            />
        </div>
    </div>

      {/* ── Transport controls ─────────────────────────────────────── */}
      <div className="transport">
        <div className="transport-buttons">
          <button
            className="transport-btn"
            onClick={handleJumpToStart}
            disabled={isLoading || !hasSteps || atStart}
            title="Jump to first step"
          >⏮</button>

          <button
            className="transport-btn"
            onClick={handlePrevStep}
            disabled={isLoading || !hasSteps || atStart}
            title="Previous step"
          >◀</button>

          <button
            className="transport-btn transport-btn--play"
            onClick={handlePlayPause}
            disabled={isLoading || (hasSteps && atEnd)}
            title={isPlaying ? 'Pause' : 'Play'}
          >{playLabel}</button>

          <button
            className="transport-btn"
            onClick={handleNextStep}
            disabled={isLoading || (hasSteps && atEnd)}
            title="Next step"
          >▶</button>

          <button
            className="transport-btn"
            onClick={handleJumpToEnd}
            disabled={isLoading || !hasSteps || atEnd}
            title="Jump to last step"
          >⏭</button>
        </div>

        {hasSteps && (
          <div className="transport-slider-row">
            <span className="transport-step-label">
              Step {currentStep + 1} / {stepCount}
            </span>
            <input
              type="range"
              className="transport-slider"
              min={0}
              max={sliderMax}
              value={currentStep}
              style={{ '--pct': `${(currentStep / sliderMax) * 100}%` }}
              onChange={(e) => handleSeekStep(Number(e.target.value))}
            />
          </div>
        )}
      </div>

      <div className="narration-card">
        <p>{narrationText}</p>
      </div>

      {introText && (
        <div className="intro-card">
          <div className="intro-card-title">{algorithm} — How it works</div>
          <p>{introText}</p>
        </div>
      )}
    </>
  );
}
