import { Project, Comparison } from "@/types/project";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Check, Minus } from "lucide-react";

interface MatrixViewProps {
  projects: Project[];
  comparisons: Comparison[];
  onSetMatrixWinner: (
    projectAId: string,
    projectBId: string,
    winnerId: string
  ) => void;
  getComparisonResult: (a: string, b: string) => string | null;
}

export function MatrixView({
  projects,
  comparisons,
  onSetMatrixWinner,
  getComparisonResult,
}: MatrixViewProps) {
  const handleCellClick = (rowId: string, colId: string) => {
    if (rowId === colId) return;
    const currentWinner = getComparisonResult(rowId, colId);
    // Toggle: if row already wins, set col as winner; otherwise set row
    const newWinner = currentWinner === rowId ? colId : rowId;
    onSetMatrixWinner(rowId, colId, newWinner);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">
          Matrice des comparaisons
        </h2>
        <p className="text-sm text-muted-foreground">
          Cliquez sur une cellule pour indiquer quel projet (ligne) l'emporte
          sur l'autre (colonne). ✓ = le projet en ligne gagne.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="min-w-[120px] font-bold">
                vs
              </TableHead>
              {projects.map((project) => (
                <TableHead
                  key={project.id}
                  className="min-w-[100px] text-center font-semibold"
                >
                  <span className="line-clamp-2 text-xs">{project.name}</span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((rowProject) => (
              <TableRow key={rowProject.id}>
                <TableCell className="font-medium text-foreground">
                  <span className="line-clamp-2 text-sm">
                    {rowProject.name}
                  </span>
                </TableCell>
                {projects.map((colProject) => {
                  if (rowProject.id === colProject.id) {
                    return (
                      <TableCell
                        key={colProject.id}
                        className="bg-muted/20 text-center"
                      >
                        <Minus className="mx-auto h-4 w-4 text-muted-foreground/30" />
                      </TableCell>
                    );
                  }

                  const winner = getComparisonResult(
                    rowProject.id,
                    colProject.id
                  );
                  const rowWins = winner === rowProject.id;
                  const colWins = winner === colProject.id;

                  return (
                    <TableCell
                      key={colProject.id}
                      className={`cursor-pointer text-center transition-colors hover:bg-primary/10 ${
                        rowWins
                          ? "bg-primary/5"
                          : colWins
                            ? "bg-destructive/5"
                            : ""
                      }`}
                      onClick={() =>
                        handleCellClick(rowProject.id, colProject.id)
                      }
                    >
                      {rowWins && (
                        <Check className="mx-auto h-4 w-4 text-primary" />
                      )}
                      {colWins && (
                        <span className="text-xs text-muted-foreground">✗</span>
                      )}
                      {!winner && (
                        <span className="text-xs text-muted-foreground/40">
                          ?
                        </span>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
