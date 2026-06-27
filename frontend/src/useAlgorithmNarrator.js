import { useState } from 'react';

export default function useAlgorithmNarrator() {
  const [narrationText, setNarrationText] = useState("Select your settings and click Next Step to start.");
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [dataArray, setDataArray] = useState([12, 45, 23, 7, 50]);
  const [customInput, setCustomInput] = useState("12, 45, 23, 7, 50");
  const [algorithm, setAlgorithm] = useState("Bubble Sort");

  const fetchStepNarration = async (algorithmName, step, phase, currentData, activeIndices) => {
    setIsLoading(true);
    try {
      const response = await fetch("http://localhost:8000/api/v1/narrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          algorithm_name: algorithmName,
          current_step: step,
          phase: phase,
          data_structure: currentData,
          highlighted_indices: activeIndices
        }),
      });

      if (!response.ok) throw new Error("Backend connection failed");
      
      const data = await response.json();
      // Expecting backend JSON format: { action, logic, result }
      setNarrationText(`${data.action}. Logic: ${data.logic}`);
      if (data.result) {
        setDataArray(data.result);
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
      .map(item => parseInt(item.trim(), 10))
      .filter(num => !isNaN(num));
    setDataArray(newArray);
    setCurrentStep(0);
    setNarrationText("Settings applied. Click 'Next Step' to begin.");
  };

  const handleNextStep = () => {
    const nextStep = currentStep + 1;
    setCurrentStep(nextStep);
    
    // Pass the 'nextStep' to the AI so it knows which part of the array to return!
    fetchStepNarration(algorithm, nextStep, "COMPARE_AND_SWAP", dataArray, [0, 1]);
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
    handleNextStep
  };
}