import { Project, Comparison } from "@/types/project";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, Trophy } from "lucide-react";

interface PairComparisonProps {
  projects: Project[];
  comparisons: Comparison[];
  currentPairIndex: number;
  completedComparisons: number;
  totalComparisons: number;
  onSetWinner: (pairIndex: number, winnerId: string) => void;
  onSetCurrentPairIndex: (index: number) => void;
  onFinish: () => void;
  allCompared: boolean;
}

export function PairComparison({
  projects,
  comparisons,
  currentPairIndex,
  completedComparisons,
  totalComparisons,
  onSetWinner,
  onSetCurrentPairIndex,
  onFinish,
  allCompared,
}: PairComparisonProps) {
  const currentPair = comparisons[currentPairIndex];
  if (!currentPair) return null;

  const projectA = projects.find((p) => p.id === currentPair.projectA);
  const projectB = projects.find((p) => p.id === currentPair.projectB);

  if (!projectA || !projectB) return null;

  const progressPercent = (completedComparisons / totalComparisons) * 100;

  const handleSelect = (winnerId: string) => {
    onSetWinner(currentPairIndex, winnerId);
    // Auto-advance to next unanswered if not last
    if (currentPairIndex < comparisons.length - 1) {
      onSetCurrentPairIndex(currentPairIndex + 1);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Comparaison {currentPairIndex + 1} / {totalComparisons}
          </span>
          <span>
            {completedComparisons} / {totalComparisons} terminée
            {completedComparisons > 1 ? "s" : ""}
          </span>
        </div>
        <Progress value={progressPercent} className="h-2" />
      </div>

      <div className="text-center">
        <h2 className="text-lg font-semibold text-foreground">
          Quel projet est prioritaire ?
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <button
          onClick={() => handleSelect(projectA.id)}
          className="group text-left"
        >
          <Card
            className={`h-full cursor-pointer transition-all hover:shadow-md ${
              currentPair.winner === projectA.id
                ? "border-primary bg-primary/5 ring-2 ring-primary"
                : "hover:border-primary/50"
            }`}
          >
            <CardContent className="flex h-full flex-col p-6">
              <div className="mb-2 flex items-center gap-2">
                {currentPair.winner === projectA.id && (
                  <Trophy className="h-4 w-4 text-primary" />
                )}
                <h3 className="text-lg font-bold text-foreground">
                  {projectA.name}
                </h3>
              </div>
              {projectA.description && (
                <p className="text-sm text-muted-foreground">
                  {projectA.description}
                </p>
              )}
            </CardContent>
          </Card>
        </button>

        <button
          onClick={() => handleSelect(projectB.id)}
          className="group text-left"
        >
          <Card
            className={`h-full cursor-pointer transition-all hover:shadow-md ${
              currentPair.winner === projectB.id
                ? "border-primary bg-primary/5 ring-2 ring-primary"
                : "hover:border-primary/50"
            }`}
          >
            <CardContent className="flex h-full flex-col p-6">
              <div className="mb-2 flex items-center gap-2">
                {currentPair.winner === projectB.id && (
                  <Trophy className="h-4 w-4 text-primary" />
                )}
                <h3 className="text-lg font-bold text-foreground">
                  {projectB.name}
                </h3>
              </div>
              {projectB.description && (
                <p className="text-sm text-muted-foreground">
                  {projectB.description}
                </p>
              )}
            </CardContent>
          </Card>
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPairIndex === 0}
            onClick={() => onSetCurrentPairIndex(currentPairIndex - 1)}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Précédent
          </Button>

          <span className="text-xs text-muted-foreground">
            {currentPairIndex + 1} / {totalComparisons}
          </span>

          <Button
            variant="outline"
            size="sm"
            disabled={currentPairIndex === comparisons.length - 1}
            onClick={() => onSetCurrentPairIndex(currentPairIndex + 1)}
          >
            Suivant
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>

        <div className="max-h-24 overflow-y-auto rounded-md border border-border/50 bg-muted/20 p-2">
          <div className="flex flex-wrap justify-center gap-1">
            {comparisons.map((c, i) => (
              <button
                key={i}
                onClick={() => onSetCurrentPairIndex(i)}
                className={`h-2.5 w-2.5 shrink-0 rounded-full transition-all ${
                  i === currentPairIndex
                    ? "scale-125 bg-primary"
                    : c.winner
                      ? "bg-primary/40"
                      : "bg-muted-foreground/20"
                }`}
                aria-label={`Comparaison ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>

      {allCompared && (
        <Button onClick={onFinish} className="w-full" size="lg">
          <Trophy className="mr-2 h-4 w-4" />
          Voir le classement
        </Button>
      )}
    </div>
  );
}
