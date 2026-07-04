import { useState, useEffect, useRef, useCallback } from 'react';

// Detailed intro shown immediately when the user starts/plays an algorithm
const ALGO_INTROS = {
  'bubble sort': `Bubble Sort repeatedly steps through the array, compares each pair of adjacent elements, and swaps them if they are in the wrong order. After every full pass the largest unsorted element has "bubbled" to its final position at the end. The process repeats, shrinking the unsorted region by one each time, until no swaps are needed and the array is fully sorted.\n\nTime complexity: O(n²) average and worst case. Space complexity: O(1). It is stable and in-place, making it easy to understand but impractical for large datasets.`,

  'selection sort': `Selection Sort divides the array into a sorted region on the left and an unsorted region on the right. On each pass it scans the entire unsorted region to find the minimum value, then swaps that minimum into the next position of the sorted region. The sorted region grows by one element each pass.\n\nTime complexity: O(n²) always — it always makes n(n-1)/2 comparisons regardless of input order. Space complexity: O(1). It is not stable but is in-place.`,

  'insertion sort': `Insertion Sort builds the sorted array one element at a time. It takes the next unsorted element and shifts all larger sorted elements one position to the right to make room, then inserts the element into its correct position. This mimics how most people sort a hand of playing cards.\n\nTime complexity: O(n²) worst case, O(n) best case on nearly-sorted data. Space complexity: O(1). It is stable and in-place — excellent for small or nearly-sorted arrays.`,

  'merge sort': `Merge Sort is a divide-and-conquer algorithm. It recursively splits the array in half until each piece has one element (already sorted), then merges pairs of pieces back together by comparing their front elements and picking the smaller one each time, producing a fully sorted merge.\n\nTime complexity: O(n log n) always. Space complexity: O(n) for the temporary merge buffer. It is stable but not in-place. The partition tree below shows each split and merge operation.`,

  'quick sort': `Quick Sort picks a pivot element, partitions the array so everything smaller than the pivot sits to its left and everything larger sits to its right, then recursively sorts each side. The pivot ends up in its final sorted position after each partition step.\n\nTime complexity: O(n log n) average, O(n²) worst case with bad pivot choices. Space complexity: O(log n) average (call stack). It is not stable but is in-place and extremely fast in practice. The partition tree shows each sub-range being divided.`,

  'heap sort': `Heap Sort first transforms the array into a Max-Heap — a binary tree where every parent is larger than its children. It then repeatedly extracts the maximum (the root) by swapping it to the end of the unsorted region and calling heapify to restore the heap property on the remaining elements.\n\nTime complexity: O(n log n) always. Space complexity: O(1). It is not stable but is in-place with guaranteed performance.`,

  '3-way merge sort': `3-Way Merge Sort extends classic Merge Sort by splitting each range into three parts instead of two. This reduces the recursion depth and can be more efficient when there are many duplicate values. Each merge step combines three sorted sub-arrays into one.\n\nTime complexity: O(n log₃ n) ≈ O(n log n). Space complexity: O(n). It is stable. The partition tree shows three-way splits and merges.`,

  'cycle sort': `Cycle Sort minimises the total number of writes to the array — it writes each element at most once. It works by finding "cycles" in the permutation: for each element it counts how many elements are smaller, determining the element's correct final index, and rotates the entire cycle of displaced elements into place.\n\nTime complexity: O(n²) comparisons. Space complexity: O(1). It achieves the theoretical minimum of O(n) writes, making it ideal when memory writes are extremely costly.`,
};

export default function useAlgorithmNarrator() {
  const [narrationText, setNarrationText] = useState("Select your settings and click Start Algorithm to begin.");
  const [introText, setIntroText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [dataArray, setDataArray] = useState([12, 45, 23, 7, 50]);
  const [customInput, setCustomInput] = useState("12, 45, 23, 7, 50");
  const [algorithm, setAlgorithm] = useState("Bubble Sort");
  const [hasShownIntro, setHasShownIntro] = useState(false);
  const [stepPlan, setStepPlan] = useState([]);
  const [compareIndices, setCompareIndices] = useState([]);
  const [swapIndices, setSwapIndices] = useState([]);
  const [pivotIndices, setPivotIndices] = useState([]);
  const [partitionTree, setPartitionTree] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Refs keep interval callback in sync with latest state without recreating it
  const currentStepRef = useRef(0);
  const stepPlanRef = useRef([]);
  const algorithmRef = useRef(algorithm);
  useEffect(() => { algorithmRef.current = algorithm; }, [algorithm]);

  // ── Normalisation helpers ─────────────────────────────────────────────
  const normalizeNumberArray = (value) => {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => {
        if (typeof item === 'number' && Number.isFinite(item)) return item;
        if (typeof item === 'string' && /^-?\d+(\.\d+)?$/.test(item.trim())) return Number(item);
        return null;
      })
      .filter((item) => item !== null);
  };

  const normalizeIndexArray = (value) => {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => {
        if (Number.isInteger(item)) return item;
        if (typeof item === 'string' && /^-?\d+$/.test(item.trim())) return Number(item);
        return null;
      })
      .filter((item) => item !== null);
  };

  // ── Apply a single step's state to the UI ────────────────────────────
  // Wrapped in useCallback so it can be safely put in a ref for the interval
  const applyStepState = useCallback((step, algoName) => {
    const nextArray = normalizeNumberArray(step?.result ?? step?.current_state ?? []);
    if (nextArray.length > 0) setDataArray(nextArray);

    setCompareIndices(normalizeIndexArray(step?.compare_indices ?? []));
    setSwapIndices(normalizeIndexArray(step?.swap_indices ?? []));
    setPivotIndices(normalizeIndexArray(step?.pivot_indices ?? []));

    const algoLower = (algoName ?? algorithmRef.current)?.toLowerCase();
    const treeAlgos = ['merge sort', '3-way merge sort', 'quick sort'];
    setPartitionTree(treeAlgos.includes(algoLower) && step?.partition_tree ? step.partition_tree : null);
    setNarrationText(`${step?.action || 'STEP'}. ${step?.logic || 'Next step.'}`);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep a stable ref so the setInterval callback can call it
  const applyStepStateRef = useRef(applyStepState);
  useEffect(() => { applyStepStateRef.current = applyStepState; }, [applyStepState]);

  // ── Fetch the full step plan from the backend ─────────────────────────
  // autoPlay: if true, start playback once steps arrive
  const fetchFullPlan = async (algorithmName, currentData, autoPlay = false) => {
    setIsLoading(true);
    try {
      const response = await fetch("http://localhost:8000/api/v1/narrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          algorithm_name: algorithmName,
          current_step: 0,
          phase: "INTRODUCTION",
          data_structure: currentData,
          highlighted_indices: []
        }),
      });

      if (!response.ok) throw new Error("Backend connection failed");

      const data = await response.json();
      const steps = Array.isArray(data.steps) && data.steps.length > 0 ? data.steps : [];

      if (steps.length > 0) {
        stepPlanRef.current = steps;
        setStepPlan(steps);
        currentStepRef.current = 0;
        setCurrentStep(0);
        applyStepState(steps[0], algorithmName);
        // Start playback if the user pressed Play before the load finished
        if (autoPlay) setIsPlaying(true);
      } else {
        setNarrationText("The AI did not return a walkthrough. Please try again.");
      }
    } catch (error) {
      setNarrationText("Error connecting to the AI backend. Check if your FastAPI server is running.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Settings reset ────────────────────────────────────────────────────
  const handleApplySettings = () => {
    const newArray = customInput
      .split(',')
      .map((item) => parseInt(item.trim(), 10))
      .filter((num) => !Number.isNaN(num));

    setDataArray(newArray);
    setCurrentStep(0);
    currentStepRef.current = 0;
    setHasShownIntro(false);
    setIsPlaying(false);
    setIntroText('');
    stepPlanRef.current = [];
    setStepPlan([]);
    setCompareIndices([]);
    setSwapIndices([]);
    setPivotIndices([]);
    setPartitionTree(null);
    setNarrationText("Settings applied. Click 'Start Algorithm' to begin.");
  };

  // ── Seek to an arbitrary step index (slider + jump buttons) ──────────
  const handleSeekStep = (index) => {
    const plan = stepPlanRef.current;
    if (plan.length === 0) return;
    const clamped = Math.max(0, Math.min(index, plan.length - 1));
    currentStepRef.current = clamped;
    setCurrentStep(clamped);
    applyStepState(plan[clamped]);
  };

  // ── Next ──────────────────────────────────────────────────────────────
  const handleNextStep = () => {
    if (!hasShownIntro) {
      setHasShownIntro(true);
      const intro = ALGO_INTROS[algorithm.toLowerCase()] ?? '';
      setIntroText(intro);
      fetchFullPlan(algorithm, dataArray, false);
      return;
    }

    const plan = stepPlanRef.current;
    if (plan.length === 0) return;

    const next = currentStepRef.current + 1;
    if (next >= plan.length) {
      setIsPlaying(false);
      setNarrationText("Algorithm complete. The walkthrough has finished.");
      setCompareIndices([]);
      setSwapIndices([]);
      setPivotIndices([]);
      setPartitionTree(null);
      return;
    }

    currentStepRef.current = next;
    setCurrentStep(next);
    applyStepState(plan[next]);
  };

  // ── Prev ──────────────────────────────────────────────────────────────
  const handlePrevStep = () => {
    const plan = stepPlanRef.current;
    if (plan.length === 0 || !hasShownIntro) return;
    const prev = currentStepRef.current - 1;
    if (prev < 0) return;
    currentStepRef.current = prev;
    setCurrentStep(prev);
    applyStepState(plan[prev]);
  };

  // ── Jump to first / last ──────────────────────────────────────────────
  const handleJumpToStart = () => {
    if (stepPlanRef.current.length === 0 || !hasShownIntro) return;
    setIsPlaying(false);
    handleSeekStep(0);
  };

  const handleJumpToEnd = () => {
    const plan = stepPlanRef.current;
    if (plan.length === 0 || !hasShownIntro) return;
    setIsPlaying(false);
    handleSeekStep(plan.length - 1);
  };

  // ── Play / Pause ──────────────────────────────────────────────────────
  const handlePlayPause = () => {
    const intro = ALGO_INTROS[algorithm.toLowerCase()] ?? '';

    if (!hasShownIntro) {
      // First press — show intro immediately, then fetch + autoplay
      setHasShownIntro(true);
      setIntroText(intro);
      fetchFullPlan(algorithm, dataArray, true);
      return;
    }

    // Already at the end — rewind to start before playing
    if (isComplete) {
      handleSeekStep(0);
      setIsPlaying(true);
      return;
    }

    setIsPlaying((prev) => !prev);
  };

  // ── Playback interval — uses refs, never goes stale ───────────────────
  useEffect(() => {
    if (!isPlaying) return;

    const id = setInterval(() => {
      const plan = stepPlanRef.current;
      const next = currentStepRef.current + 1;

      if (next >= plan.length) {
        setIsPlaying(false);
        setNarrationText("Algorithm complete. The walkthrough has finished.");
        setCompareIndices([]);
        setSwapIndices([]);
        setPivotIndices([]);
        setPartitionTree(null);
        clearInterval(id);
        return;
      }

      currentStepRef.current = next;
      setCurrentStep(next);
      applyStepStateRef.current(plan[next]);
    }, 700);

    return () => clearInterval(id);
  }, [isPlaying]);

  const stepCount = stepPlan.length;
  const isComplete = hasShownIntro && stepCount > 0 && currentStep >= stepCount - 1;

  return {
    narrationText,
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
  };
}
