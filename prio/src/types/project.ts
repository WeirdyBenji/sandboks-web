export interface Project {
  id: string;
  name: string;
  description: string;
}

export interface Comparison {
  projectA: string; // project id
  projectB: string; // project id
  winner: string | null; // project id of winner, null if not yet compared
}

export interface PrioritizationSession {
  projects: Project[];
  comparisons: Comparison[];
}

export type AppStep = "projects" | "compare" | "matrix" | "ranking";

export function generatePairs(projects: Project[]): Comparison[] {
  const pairs: Comparison[] = [];
  for (let i = 0; i < projects.length; i++) {
    for (let j = i + 1; j < projects.length; j++) {
      pairs.push({
        projectA: projects[i].id,
        projectB: projects[j].id,
        winner: null,
      });
    }
  }
  return pairs;
}

function comparisonKey(projectA: string, projectB: string): string {
  return [projectA, projectB].sort().join("::");
}

export function mergeComparisonPairs(
  projects: Project[],
  existingComparisons: Comparison[]
): Comparison[] {
  const projectIds = new Set(projects.map((project) => project.id));
  const existingByPair = new Map(
    existingComparisons
      .filter(
        (comparison) =>
          projectIds.has(comparison.projectA) && projectIds.has(comparison.projectB)
      )
      .map((comparison) => [
        comparisonKey(comparison.projectA, comparison.projectB),
        comparison,
      ])
  );

  return generatePairs(projects).map((pair) => {
    const existing = existingByPair.get(comparisonKey(pair.projectA, pair.projectB));
    return existing ? { ...pair, winner: existing.winner } : pair;
  });
}

export function firstPendingComparisonIndex(comparisons: Comparison[]): number {
  const index = comparisons.findIndex((comparison) => comparison.winner === null);
  return index === -1 ? Math.max(comparisons.length - 1, 0) : index;
}

export function calculateRankings(
  projects: Project[],
  comparisons: Comparison[]
): { project: Project; wins: number; total: number }[] {
  const winCounts: Record<string, number> = {};
  projects.forEach((p) => (winCounts[p.id] = 0));

  const decidedComparisons = comparisons.filter((c) => c.winner !== null);
  decidedComparisons.forEach((c) => {
    if (c.winner && winCounts[c.winner] !== undefined) {
      winCounts[c.winner]++;
    }
  });

  const totalComparisons = projects.length - 1;

  return projects
    .map((project) => ({
      project,
      wins: winCounts[project.id] || 0,
      total: totalComparisons,
    }))
    .sort((a, b) => b.wins - a.wins);
}

export function getComparisonResult(
  comparisons: Comparison[],
  projectAId: string,
  projectBId: string
): string | null {
  const comparison = comparisons.find(
    (c) =>
      (c.projectA === projectAId && c.projectB === projectBId) ||
      (c.projectA === projectBId && c.projectB === projectAId)
  );
  return comparison?.winner ?? null;
}
