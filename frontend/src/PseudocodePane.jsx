import React, { useEffect, useRef } from 'react';

// ── Pseudocode definitions ────────────────────────────────────────────────
// Each entry has:
//   lines   : the pseudocode lines to display (1-based externally, 0-based in array)
//   highlight: map of action-type → array of 0-based line indices to highlight

const PSEUDOCODE = {
  'bubble sort': {
    lines: [
      'procedure bubbleSort(A):',
      '  n ← length(A)',
      '  repeat',
      '    swapped ← false',
      '    for i ← 0 to n − 2 do',
      '      if A[i] > A[i + 1] then',
      '        swap(A[i], A[i + 1])',
      '        swapped ← true',
      '      end if',
      '    end for',
      '    n ← n − 1',
      '  until not swapped',
      '  return A',
    ],
    highlight: {
      INTRODUCTION:      [0, 1],
      COMPARE:           [4, 5],
      COMPARE_AND_SWAP:  [4, 5, 6, 7],
      DONE:              [11],
      SORTED:            [12],
    },
  },

  'selection sort': {
    lines: [
      'procedure selectionSort(A):',
      '  n ← length(A)',
      '  for i ← 0 to n − 2 do',
      '    minIdx ← i',
      '    for j ← i + 1 to n − 1 do',
      '      if A[j] < A[minIdx] then',
      '        minIdx ← j',
      '      end if',
      '    end for',
      '    if minIdx ≠ i then',
      '      swap(A[i], A[minIdx])',
      '    end if',
      '  end for',
      '  return A',
    ],
    highlight: {
      INTRODUCTION:      [0, 1],
      COMPARE:           [4, 5, 6],
      COMPARE_AND_SWAP:  [9, 10],
      SORTED:            [13],
    },
  },

  'insertion sort': {
    lines: [
      'procedure insertionSort(A):',
      '  for i ← 1 to length(A) − 1 do',
      '    key ← A[i]',
      '    j ← i − 1',
      '    while j ≥ 0 and A[j] > key do',
      '      A[j + 1] ← A[j]',
      '      j ← j − 1',
      '    end while',
      '    A[j + 1] ← key',
      '  end for',
      '  return A',
    ],
    highlight: {
      INTRODUCTION:      [0],
      COMPARE:           [1, 2, 3, 4],
      COMPARE_AND_SWAP:  [4, 5, 6, 8],
      SORTED:            [10],
    },
  },

  'merge sort': {
    lines: [
      'procedure mergeSort(A, low, high):',
      '  if low ≥ high then return',
      '  mid ← ⌊(low + high) / 2⌋',
      '  mergeSort(A, low, mid)        // left half',
      '  mergeSort(A, mid + 1, high)   // right half',
      '  merge(A, low, mid, high)',
      '',
      'procedure merge(A, low, mid, high):',
      '  left  ← A[low .. mid]',
      '  right ← A[mid+1 .. high]',
      '  i ← 0;  j ← 0;  k ← low',
      '  while i < len(left) and j < len(right) do',
      '    if left[i] ≤ right[j] then',
      '      A[k] ← left[i];  i ← i + 1',
      '    else',
      '      A[k] ← right[j];  j ← j + 1',
      '    end if',
      '    k ← k + 1',
      '  end while',
      '  copy remaining elements',
    ],
    highlight: {
      INTRODUCTION:      [0, 1],
      SPLIT:             [1, 2, 3, 4],
      COMPARE:           [11, 12, 13],
      COMPARE_AND_SWAP:  [11, 12, 13, 15],
      MERGE:             [5, 7, 8, 9, 10, 11],
      SORTED:            [19],
    },
  },

  'quick sort': {
    lines: [
      'procedure quickSort(A, low, high):',
      '  if low < high then',
      '    p ← partition(A, low, high)',
      '    quickSort(A, low, p − 1)',
      '    quickSort(A, p + 1, high)',
      '  end if',
      '',
      'procedure partition(A, low, high):',
      '  pivot ← A[high]',
      '  i ← low − 1',
      '  for j ← low to high − 1 do',
      '    if A[j] ≤ pivot then',
      '      i ← i + 1',
      '      swap(A[i], A[j])',
      '    end if',
      '  end for',
      '  swap(A[i + 1], A[high])   // place pivot',
      '  return i + 1',
    ],
    highlight: {
      INTRODUCTION:      [0, 1],
      PIVOT:             [7, 8, 9],
      COMPARE:           [10, 11],
      COMPARE_AND_SWAP:  [10, 11, 12, 13],
      SORTED:            [17],
    },
  },

  'heap sort': {
    lines: [
      'procedure heapSort(A):',
      '  n ← length(A)',
      '  // Build max-heap',
      '  for i ← ⌊n/2⌋ − 1 downto 0 do',
      '    heapify(A, n, i)',
      '  end for',
      '  // Extract elements from heap',
      '  for end ← n − 1 downto 1 do',
      '    swap(A[0], A[end])',
      '    heapify(A, end, 0)',
      '  end for',
      '',
      'procedure heapify(A, size, root):',
      '  largest ← root',
      '  left  ← 2 × root + 1',
      '  right ← 2 × root + 2',
      '  if left < size and A[left] > A[largest]',
      '    then largest ← left',
      '  if right < size and A[right] > A[largest]',
      '    then largest ← right',
      '  if largest ≠ root then',
      '    swap(A[root], A[largest])',
      '    heapify(A, size, largest)',
      '  end if',
    ],
    highlight: {
      INTRODUCTION:      [0, 1, 2, 3],
      COMPARE:           [12, 13, 14, 15, 16, 17, 18, 19],
      COMPARE_AND_SWAP:  [20, 21, 22],
      SORTED:            [10],
    },
  },

  '3-way merge sort': {
    lines: [
      'procedure mergeSort3(A, low, high):',
      '  if low ≥ high then return',
      '  span ← high − low + 1',
      '  mid1 ← low + span / 3',
      '  mid2 ← low + 2 × span / 3',
      '  mergeSort3(A, low, mid1 − 1)',
      '  mergeSort3(A, mid1, mid2 − 1)',
      '  mergeSort3(A, mid2, high)',
      '  merge3(A, low, mid1, mid2, high)',
      '',
      'procedure merge3(A, low, mid1, mid2, high):',
      '  left   ← A[low .. mid1−1]',
      '  middle ← A[mid1 .. mid2−1]',
      '  right  ← A[mid2 .. high]',
      '  merged ← sort(left + middle + right)',
      '  copy merged back into A[low .. high]',
    ],
    highlight: {
      INTRODUCTION:      [0, 1],
      SPLIT:             [1, 2, 3, 4, 5, 6, 7],
      COMPARE:           [10, 11, 12, 13],
      COMPARE_AND_SWAP:  [14, 15],
      MERGE:             [8, 10, 14, 15],
      SORTED:            [15],
    },
  },

  'cycle sort': {
    lines: [
      'procedure cycleSort(A):',
      '  n ← length(A)',
      '  for cycleStart ← 0 to n − 2 do',
      '    item ← A[cycleStart]',
      '    pos  ← cycleStart',
      '    // Count smaller elements to find correct position',
      '    for i ← cycleStart + 1 to n − 1 do',
      '      if A[i] < item then pos ← pos + 1',
      '    end for',
      '    if pos = cycleStart then continue',
      '    while item = A[pos] do pos ← pos + 1',
      '    swap(A[pos], item)',
      '    // Rotate the rest of the cycle',
      '    while pos ≠ cycleStart do',
      '      pos ← cycleStart',
      '      for i ← cycleStart+1 to n−1 do',
      '        if A[i] < item then pos ← pos + 1',
      '      end for',
      '      while item = A[pos] do pos ← pos + 1',
      '      swap(A[pos], item)',
      '    end while',
      '  end for',
      '  return A',
    ],
    highlight: {
      INTRODUCTION:      [0, 1],
      COMPARE:           [6, 7, 9],
      COMPARE_AND_SWAP:  [10, 11, 13, 14, 15, 16, 18, 19],
      SORTED:            [22],
    },
  },
};

// ── Component ─────────────────────────────────────────────────────────────

export default function PseudocodePane({ algorithm, action, hasStarted }) {
  const algoKey   = algorithm?.toLowerCase() ?? '';
  const spec      = PSEUDOCODE[algoKey];
  const activeRef = useRef(null);

  // Scroll the first highlighted line into view whenever the action changes
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [action]);

  if (!spec) {
    return (
      <div className="pseudocode-pane pseudocode-pane--empty">
        <div className="pseudocode-header">Pseudocode</div>
        <p className="pseudocode-empty-msg">No pseudocode available for this algorithm.</p>
      </div>
    );
  }

  const highlightedLines = new Set(
    hasStarted && action ? (spec.highlight[action] ?? []) : []
  );

  return (
    <div className="pseudocode-pane">
      <div className="pseudocode-header">
        <span>Pseudocode</span>
        {hasStarted && action && (
          <span className="pseudocode-action-tag">{action.replace(/_/g, ' ')}</span>
        )}
      </div>
      <pre className="pseudocode-pre">
        {spec.lines.map((line, i) => {
          const isActive = highlightedLines.has(i);
          return (
            <div
              key={i}
              ref={isActive ? activeRef : null}
              className={`pseudocode-line${isActive ? ' pseudocode-line--active' : ''}`}
            >
              <span className="pseudocode-lineno">{i + 1}</span>
              <span className="pseudocode-text">{line || '\u00A0'}</span>
            </div>
          );
        })}
      </pre>
    </div>
  );
}
