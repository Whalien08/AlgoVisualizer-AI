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

  const applyStepState = (step) => {
    const nextArray = Array.isArray(step?.result)
      ? step.result.filter((value) => Number.isFinite(value))
      : [];

    if (nextArray.length > 0) {
      setDataArray(nextArray);
    }

    const nextCompareIndices = Array.isArray(step?.compare_indices)
      ? step.compare_indices.filter((value) => Number.isInteger(value))
      : [];
    const nextSwapIndices = Array.isArray(step?.swap_indices)
      ? step.swap_indices.filter((value) => Number.isInteger(value))
      : [];

    setCompareIndices(nextCompareIndices);
    setSwapIndices(nextSwapIndices);
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
    swapIndices
  };
}