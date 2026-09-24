import { useState } from "react";
import { Project } from "@/types/project";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Pencil, Trash2, Check, X, ArrowUpDown } from "lucide-react";

interface ProjectManagerProps {
  projects: Project[];
  onAdd: (name: string, description: string) => void;
  onUpdate: (id: string, name: string, description: string) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, targetId: string) => void;
  onStartComparison: () => void;
}

export function ProjectManager({
  projects,
  onAdd,
  onUpdate,
  onRemove,
  onMove,
  onStartComparison,
}: ProjectManagerProps) {
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const handleAdd = () => {
    if (newName.trim()) {
      onAdd(newName.trim(), newDescription.trim());
      setNewName("");
      setNewDescription("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAdd();
    }
  };

  const startEdit = (project: Project) => {
    setEditingId(project.id);
    setEditName(project.name);
    setEditDescription(project.description);
  };

  const saveEdit = () => {
    if (editingId && editName.trim()) {
      onUpdate(editingId, editName.trim(), editDescription.trim());
      setEditingId(null);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">
          Ajouter un projet
        </h2>
        <div className="flex gap-3">
          <div className="flex-1 space-y-2">
            <Input
              placeholder="Nom du projet"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <Textarea
              placeholder="Description (optionnelle)"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className="min-h-[60px] resize-none"
            />
          </div>
          <Button
            onClick={handleAdd}
            disabled={!newName.trim()}
            size="icon"
            className="h-10 w-10 shrink-0 self-start"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {projects.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">
            Projets ({projects.length})
          </h2>
          <div className="space-y-2">
            {projects.map((project, index) => (
              <Card
                key={project.id}
                className={`border-border/50 transition-colors ${
                  dragOverId === project.id && draggingId !== project.id
                    ? "border-primary bg-primary/5"
                    : ""
                } ${draggingId === project.id ? "opacity-60" : ""}`}
                onDragOver={(event) => {
                  if (!draggingId || draggingId === project.id) return;
                  event.preventDefault();
                  setDragOverId(project.id);
                }}
                onDragLeave={() => {
                  if (dragOverId === project.id) setDragOverId(null);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (draggingId) onMove(draggingId, project.id);
                  setDraggingId(null);
                  setDragOverId(null);
                }}
              >
                <CardContent className="p-4">
                  {editingId === project.id ? (
                    <div className="space-y-2">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
                      />
                      <Textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="min-h-[60px] resize-none"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={saveEdit}>
                          <Check className="mr-1 h-3 w-3" />
                          Sauvegarder
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={cancelEdit}
                        >
                          <X className="mr-1 h-3 w-3" />
                          Annuler
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {index + 1}
                          </span>
                          <h3 className="truncate font-medium text-foreground">
                            {project.name}
                          </h3>
                        </div>
                        {project.description && (
                          <p className="mt-1 pl-8 text-sm text-muted-foreground">
                            {project.description}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          draggable
                          className="flex h-8 w-8 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground active:cursor-grabbing"
                          onDragStart={(event) => {
                            event.dataTransfer.effectAllowed = "move";
                            event.dataTransfer.setData("text/plain", project.id);
                            setDraggingId(project.id);
                          }}
                          onDragEnd={() => {
                            setDraggingId(null);
                            setDragOverId(null);
                          }}
                          aria-label={`Déplacer ${project.name}`}
                          title="Glisser-déposer pour réordonner"
                        >
                          <ArrowUpDown className="h-3.5 w-3.5" />
                        </button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => startEdit(project)}
                          aria-label={`Modifier ${project.name}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => onRemove(project.id)}
                          aria-label={`Supprimer ${project.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {projects.length >= 2 && (
        <Button onClick={onStartComparison} className="w-full" size="lg">
          Lancer la comparaison ({(projects.length * (projects.length - 1)) / 2}{" "}
          paires)
        </Button>
      )}

      {projects.length < 2 && projects.length > 0 && (
        <p className="text-center text-sm text-muted-foreground">
          Ajoutez au moins 2 projets pour commencer la comparaison.
        </p>
      )}
    </div>
  );
}
