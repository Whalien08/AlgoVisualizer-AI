import { useState } from 'react';

export default function useAlgorithmNarrator() {
  const [narrationText, setNarrationText] = useState("Select your settings and click Start Algorithm to begin.");
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

  const normalizeNumberArray = (value) => {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => {
        if (typeof item === 'number' && Number.isFinite(item)) {
          return item;
        }
        if (typeof item === 'string' && /^-?\d+(\.\d+)?$/.test(item.trim())) {
          return Number(item);
        }
        return null;
      })
      .filter((item) => item !== null);
  };

  const normalizeIndexArray = (value) => {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => {
        if (Number.isInteger(item)) {
          return item;
        }
        if (typeof item === 'string' && /^-?\d+$/.test(item.trim())) {
          return Number(item);
        }
        return null;
      })
      .filter((item) => item !== null);
  };

  const applyStepState = (step) => {
    const nextArray = normalizeNumberArray(step?.result ?? step?.current_state ?? []);

    if (nextArray.length > 0) {
      setDataArray(nextArray);
    }

    const nextCompareIndices = normalizeIndexArray(step?.compare_indices ?? []);
    const nextSwapIndices = normalizeIndexArray(step?.swap_indices ?? []);
    const nextPivotIndices = normalizeIndexArray(step?.pivot_indices ?? []);

    setCompareIndices(nextCompareIndices);
    setSwapIndices(nextSwapIndices);
    setPivotIndices(nextPivotIndices);
    setPartitionTree(algorithm?.toLowerCase() === 'merge sort' && step?.partition_tree ? step.partition_tree : null);
    setNarrationText(`${step?.action || 'STEP'}. ${step?.logic || 'Next step.'}`);
  };

  const fetchFullPlan = async (algorithmName, currentData) => {
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
        setStepPlan(steps);
        setCurrentStep(0);
        applyStepState(steps[0]);
      } else {
        setNarrationText("The AI did not return a walkthrough. Please try again.");
      }
    } catch (error) {
      setNarrationText("Error connecting to the AI backend. Check if your FastAPI server is running.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplySettings = () => {
    const newArray = customInput
      .split(',')
      .map((item) => parseInt(item.trim(), 10))
      .filter((num) => !Number.isNaN(num));

    setDataArray(newArray);
    setCurrentStep(0);
    setHasShownIntro(false);
    setStepPlan([]);
    setCompareIndices([]);
    setSwapIndices([]);
    setPivotIndices([]);
    setPartitionTree(null);
    setNarrationText("Settings applied. Click 'Start Algorithm' to hear an introduction.");
  };

  const handleNextStep = () => {
    if (!hasShownIntro) {
      setHasShownIntro(true);
      fetchFullPlan(algorithm, dataArray);
      return;
    }

    if (stepPlan.length === 0) {
      return;
    }

    const nextStepIndex = currentStep + 1;
    if (nextStepIndex >= stepPlan.length) {
      setNarrationText("Algorithm complete. The walkthrough has finished.");
      setCompareIndices([]);
      setSwapIndices([]);
      setPivotIndices([]);
      setPartitionTree(null);
      return;
    }

    setCurrentStep(nextStepIndex);
    applyStepState(stepPlan[nextStepIndex]);
  };

  return {
    narrationText,
    isLoading,
    currentStep,
    dataArray,
    customInput,
    setCustomInput,
    algorithm,
    setAlgorithm,
    handleApplySettings,
    handleNextStep,
    hasShownIntro,
    compareIndices,
    swapIndices,
    pivotIndices,
    partitionTree
  };
}