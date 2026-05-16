import { useCallback, useMemo } from "react";
import { useLocalStorage } from "./useLocalStorage";
import {
  Project,
  Comparison,
  AppStep,
  generatePairs,
  calculateRankings,
  getComparisonResult,
} from "@/types/project";

const STORAGE_KEY = "prioritization-matrix";

interface StoredState {
  projects: Project[];
  comparisons: Comparison[];
  currentStep: AppStep;
  currentPairIndex: number;
}

const defaultState: StoredState = {
  projects: [],
  comparisons: [],
  currentStep: "projects",
  currentPairIndex: 0,
};

export function usePrioritization() {
  const [state, setState, resetState] = useLocalStorage<StoredState>(
    STORAGE_KEY,
    defaultState
  );

  const addProject = useCallback(
    (name: string, description: string = "") => {
      setState((prev) => ({
        ...prev,
        projects: [
          ...prev.projects,
          { id: crypto.randomUUID(), name, description },
        ],
        comparisons: [], // reset comparisons when projects change
        currentPairIndex: 0,
      }));
    },
    [setState]
  );

  const updateProject = useCallback(
    (id: string, name: string, description: string) => {
      setState((prev) => ({
        ...prev,
        projects: prev.projects.map((p) =>
          p.id === id ? { ...p, name, description } : p
        ),
      }));
    },
    [setState]
  );

  const removeProject = useCallback(
    (id: string) => {
      setState((prev) => ({
        ...prev,
        projects: prev.projects.filter((p) => p.id !== id),
        comparisons: [],
        currentPairIndex: 0,
      }));
    },
    [setState]
  );

  const startComparison = useCallback(() => {
    setState((prev) => ({
      ...prev,
      comparisons: generatePairs(prev.projects),
      currentStep: "compare",
      currentPairIndex: 0,
    }));
  }, [setState]);

  const setWinner = useCallback(
    (pairIndex: number, winnerId: string) => {
      setState((prev) => {
        const newComparisons = [...prev.comparisons];
        newComparisons[pairIndex] = {
          ...newComparisons[pairIndex],
          winner: winnerId,
        };
        const nextIndex = Math.min(pairIndex + 1, newComparisons.length - 1);
        return {
          ...prev,
          comparisons: newComparisons,
          currentPairIndex:
            pairIndex < newComparisons.length - 1
              ? nextIndex
              : prev.currentPairIndex,
        };
      });
    },
    [setState]
  );

  const setMatrixWinner = useCallback(
    (projectAId: string, projectBId: string, winnerId: string) => {
      setState((prev) => {
        const newComparisons = prev.comparisons.map((c) => {
          if (
            (c.projectA === projectAId && c.projectB === projectBId) ||
            (c.projectA === projectBId && c.projectB === projectAId)
          ) {
            return { ...c, winner: winnerId };
          }
          return c;
        });
        return { ...prev, comparisons: newComparisons };
      });
    },
    [setState]
  );

  const setCurrentPairIndex = useCallback(
    (index: number) => {
      setState((prev) => ({ ...prev, currentPairIndex: index }));
    },
    [setState]
  );

  const setStep = useCallback(
    (step: AppStep) => {
      setState((prev) => ({ ...prev, currentStep: step }));
    },
    [setState]
  );

  const resetAll = useCallback(() => {
    resetState();
  }, [resetState]);

  const rankings = useMemo(
    () => calculateRankings(state.projects, state.comparisons),
    [state.projects, state.comparisons]
  );

  const completedComparisons = useMemo(
    () => state.comparisons.filter((c) => c.winner !== null).length,
    [state.comparisons]
  );

  const totalComparisons = state.comparisons.length;
  const allCompared = totalComparisons > 0 && completedComparisons === totalComparisons;

  return {
    projects: state.projects,
    comparisons: state.comparisons,
    currentStep: state.currentStep,
    currentPairIndex: state.currentPairIndex,
    rankings,
    completedComparisons,
    totalComparisons,
    allCompared,
    addProject,
    updateProject,
    removeProject,
    startComparison,
    setWinner,
    setMatrixWinner,
    setCurrentPairIndex,
    setStep,
    resetAll,
    getComparisonResult: (a: string, b: string) =>
      getComparisonResult(state.comparisons, a, b),
  };
}
