import { useCallback, useMemo } from "react";
import { useLocalStorage } from "./useLocalStorage";
import {
  Project,
  Comparison,
  AppStep,
  calculateRankings,
  firstPendingComparisonIndex,
  getComparisonResult,
  mergeComparisonPairs,
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
      setState((prev) => {
        const projects = [
          ...prev.projects,
          { id: crypto.randomUUID(), name, description },
        ];
        const comparisons =
          prev.comparisons.length > 0
            ? mergeComparisonPairs(projects, prev.comparisons)
            : prev.comparisons;

        return {
          ...prev,
          projects,
          comparisons,
          currentPairIndex:
            comparisons.length > 0
              ? firstPendingComparisonIndex(comparisons)
              : prev.currentPairIndex,
        };
      });
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
      setState((prev) => {
        const projects = prev.projects.filter((project) => project.id !== id);
        const comparisons = mergeComparisonPairs(projects, prev.comparisons);

        return {
          ...prev,
          projects,
          comparisons,
          currentPairIndex: firstPendingComparisonIndex(comparisons),
        };
      });
    },
    [setState]
  );

  const moveProject = useCallback(
    (id: string, targetId: string) => {
      if (id === targetId) return;

      setState((prev) => {
        const currentIndex = prev.projects.findIndex((project) => project.id === id);
        const targetIndex = prev.projects.findIndex((project) => project.id === targetId);
        if (currentIndex === -1 || targetIndex === -1) return prev;

        const projects = [...prev.projects];
        const [project] = projects.splice(currentIndex, 1);
        projects.splice(targetIndex, 0, project);
        const comparisons = mergeComparisonPairs(projects, prev.comparisons);

        return {
          ...prev,
          projects,
          comparisons,
          currentPairIndex:
            comparisons.length > 0
              ? Math.min(prev.currentPairIndex, comparisons.length - 1)
              : 0,
        };
      });
    },
    [setState]
  );

  const startComparison = useCallback(() => {
    setState((prev) => {
      const comparisons = mergeComparisonPairs(prev.projects, prev.comparisons);

      return {
        ...prev,
        comparisons,
        currentStep: "compare",
        currentPairIndex: firstPendingComparisonIndex(comparisons),
      };
    });
  }, [setState]);

  const setWinner = useCallback(
    (pairIndex: number, winnerId: string) => {
      setState((prev) => {
        const newComparisons = [...prev.comparisons];
        newComparisons[pairIndex] = {
          ...newComparisons[pairIndex],
          winner: winnerId,
        };
        const nextIndex = newComparisons.findIndex(
          (comparison, index) => index > pairIndex && comparison.winner === null
        );
        return {
          ...prev,
          comparisons: newComparisons,
          currentPairIndex:
            nextIndex !== -1
              ? nextIndex
              : firstPendingComparisonIndex(newComparisons),
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
    moveProject,
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
