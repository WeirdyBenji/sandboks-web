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
