import { Project } from "@/types/project";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Trophy, Medal, Award } from "lucide-react";

interface RankingViewProps {
  rankings: { project: Project; wins: number; total: number }[];
}

const podiumIcons: Record<number, React.ReactNode> = {
  0: <Trophy className="h-6 w-6 text-primary" />,
  1: <Medal className="h-6 w-6 text-muted-foreground" />,
  2: <Award className="h-6 w-6 text-accent-foreground" />,
};

export function RankingView({ rankings }: RankingViewProps) {
  const maxWins = rankings.length > 0 ? rankings[0].wins : 1;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">
          Classement Final
        </h2>
        <p className="text-sm text-muted-foreground">
          Projets classés par nombre de victoires dans les comparaisons par
          paires.
        </p>
      </div>

      <div className="space-y-3">
        {rankings.map((entry, index) => {
          const percentage = maxWins > 0 ? (entry.wins / maxWins) * 100 : 0;
          const isTop3 = index < 3;

          return (
            <Card
              key={entry.project.id}
              className={`transition-all ${
                isTop3 ? "border-primary/30 shadow-sm" : "border-border/50"
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center">
                    {isTop3 ? (
                      podiumIcons[index]
                    ) : (
                      <span className="text-lg font-bold text-muted-foreground">
                        {index + 1}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3
                        className={`truncate font-semibold ${
                          isTop3 ? "text-foreground" : "text-foreground/80"
                        }`}
                      >
                        {entry.project.name}
                      </h3>
                      <span className="shrink-0 text-sm font-medium text-muted-foreground">
                        {entry.wins} / {entry.total} victoire
                        {entry.wins > 1 ? "s" : ""}
                      </span>
                    </div>
                    {entry.project.description && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {entry.project.description}
                      </p>
                    )}
                    <Progress
                      value={percentage}
                      className="mt-2 h-2"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
