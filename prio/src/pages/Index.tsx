import { usePrioritization } from "@/hooks/usePrioritization";
import { ProjectManager } from "@/components/ProjectManager";
import { PairComparison } from "@/components/PairComparison";
import { MatrixView } from "@/components/MatrixView";
import { RankingView } from "@/components/RankingView";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  ListPlus,
  Swords,
  Grid3X3,
  Trophy,
  RotateCcw,
} from "lucide-react";
import type { AppStep } from "@/types/project";

const Index = () => {
  const {
    projects,
    comparisons,
    currentStep,
    currentPairIndex,
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
    getComparisonResult,
  } = usePrioritization();

  const hasComparisons = comparisons.length > 0;

  const handleTabChange = (value: string) => {
    setStep(value as AppStep);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Matrice de Priorisation
            </h1>
            <p className="text-sm text-muted-foreground">
              Comparez vos projets par paires pour établir un classement
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={resetAll}
            className="text-muted-foreground hover:text-destructive"
          >
            <RotateCcw className="mr-1 h-3.5 w-3.5" />
            Réinitialiser
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <Tabs value={currentStep} onValueChange={handleTabChange}>
          <TabsList className="mb-6 grid w-full grid-cols-4">
            <TabsTrigger value="projects" className="gap-1.5 text-xs sm:text-sm">
              <ListPlus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Projets</span>
            </TabsTrigger>
            <TabsTrigger
              value="compare"
              disabled={!hasComparisons}
              className="gap-1.5 text-xs sm:text-sm"
            >
              <Swords className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Comparer</span>
            </TabsTrigger>
            <TabsTrigger
              value="matrix"
              disabled={!hasComparisons}
              className="gap-1.5 text-xs sm:text-sm"
            >
              <Grid3X3 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Matrice</span>
            </TabsTrigger>
            <TabsTrigger
              value="ranking"
              disabled={!hasComparisons}
              className="gap-1.5 text-xs sm:text-sm"
            >
              <Trophy className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Classement</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="projects">
            <ProjectManager
              projects={projects}
              onAdd={addProject}
              onUpdate={updateProject}
              onRemove={removeProject}
              onMove={moveProject}
              onStartComparison={startComparison}
            />
          </TabsContent>

          <TabsContent value="compare">
            <PairComparison
              projects={projects}
              comparisons={comparisons}
              currentPairIndex={currentPairIndex}
              completedComparisons={completedComparisons}
              totalComparisons={totalComparisons}
              onSetWinner={setWinner}
              onSetCurrentPairIndex={setCurrentPairIndex}
              onFinish={() => setStep("ranking")}
              allCompared={allCompared}
            />
          </TabsContent>

          <TabsContent value="matrix">
            <MatrixView
              projects={projects}
              comparisons={comparisons}
              onSetMatrixWinner={setMatrixWinner}
              getComparisonResult={getComparisonResult}
            />
          </TabsContent>

          <TabsContent value="ranking">
            <RankingView rankings={rankings} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
