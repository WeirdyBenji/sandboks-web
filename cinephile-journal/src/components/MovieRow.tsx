import { useState } from 'react';
import { Movie, ColumnVisibility } from '@/types/movie';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TableCell, TableRow } from '@/components/ui/table';
import { Trash2, ArrowRight, Check, X, Edit2 } from 'lucide-react';

interface MovieRowProps {
  movie: Movie;
  onRemove: (id: string) => void;
  onMove: (id: string, status: 'toWatch' | 'watched') => void;
  onUpdateNote: (id: string, note: string) => void;
  targetStatus: 'toWatch' | 'watched';
  columnVisibility: ColumnVisibility;
}

export function MovieRow({
  movie,
  onRemove,
  onMove,
  onUpdateNote,
  targetStatus,
  columnVisibility,
}: MovieRowProps) {
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteValue, setNoteValue] = useState(movie.personalNote);

  const handleSaveNote = () => {
    onUpdateNote(movie.id, noteValue);
    setIsEditingNote(false);
  };

  const handleCancelNote = () => {
    setNoteValue(movie.personalNote);
    setIsEditingNote(false);
  };

  const getRTColor = (score: number | null) => {
    if (score === null) return 'text-muted-foreground';
    if (score >= 75) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <TableRow>
      {columnVisibility.poster && (
        <TableCell>
          <img
            src={movie.poster}
            alt={movie.title}
            className="h-12 w-8 rounded object-cover"
          />
        </TableCell>
      )}
      <TableCell className="font-medium">{movie.title}</TableCell>
      {columnVisibility.year && (
        <TableCell>{movie.year || 'N/A'}</TableCell>
      )}
      {columnVisibility.rtScores && (
        <>
          <TableCell>
            <span className={`font-semibold ${getRTColor(movie.rtCriticsScore)}`}>
              {movie.rtCriticsScore !== null ? `${movie.rtCriticsScore}%` : '—'}
            </span>
          </TableCell>
          <TableCell>
            <span className={`font-semibold ${getRTColor(movie.rtAudienceScore)}`}>
              {movie.rtAudienceScore !== null ? `${movie.rtAudienceScore}%` : '—'}
            </span>
          </TableCell>
        </>
      )}
      <TableCell>
        {isEditingNote ? (
          <div className="flex items-center gap-1">
            <Input
              value={noteValue}
              onChange={(e) => setNoteValue(e.target.value)}
              className="h-8 text-sm"
              placeholder="Votre note..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveNote();
                if (e.key === 'Escape') handleCancelNote();
              }}
            />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleSaveNote}>
              <Check className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCancelNote}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div 
            className="flex items-center gap-2 cursor-pointer group"
            onClick={() => setIsEditingNote(true)}
          >
            <span className={movie.personalNote ? 'text-sm' : 'text-sm text-muted-foreground italic'}>
              {movie.personalNote || 'Ajouter une note...'}
            </span>
            <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-100 text-muted-foreground" />
          </div>
        )}
      </TableCell>
      {columnVisibility.actions && (
        <TableCell>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onMove(movie.id, targetStatus)}
              title={targetStatus === 'watched' ? 'Marquer comme vu' : 'Remettre à voir'}
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => onRemove(movie.id)}
              title="Supprimer"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      )}
    </TableRow>
  );
}
