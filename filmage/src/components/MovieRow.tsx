import { useRef, useState } from 'react';
import { Movie, ColumnVisibility } from '@/types/movie';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { TableCell, TableRow } from '@/components/ui/table';
import { Trash2, ArrowRight, Check, X, Edit2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface MovieRowProps {
  movie: Movie;
  showEnteredBy: boolean;
  onRemove: (id: string) => void;
  onMove: (id: string, status: 'toWatch' | 'watched') => void;
  onUpdateNote: (id: string, note: string) => void;
  onUpdateWatchedAt: (id: string, watchedAt: string) => void;
  onUpdateEnteredBy: (id: string, enteredBy: string) => void;
  onUpdateTitle: (id: string, title: string) => void;
  onUpdateRottenTomatoesScores: (id: string, rtCriticsScore: number | null, rtAudienceScore: number | null) => void;
  onUpdateCategory: (id: string, category: string) => void;
  onUpdateMar: (id: string, mar: boolean) => void;
  onUpdateBenji: (id: string, benji: boolean) => void;
  targetStatus: 'toWatch' | 'watched';
  columnVisibility: ColumnVisibility;
}

const categories = [
  'top 50',
  'césar',
  'oscar',
  'film',
  'tim burton',
  'bong joon ho',
  'anime',
  'animation',
  'série',
];

const shortMonthByName: Record<string, string> = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
};

function getWatchedMonth(watchedAt?: string) {
  if (!watchedAt) {
    return '';
  }

  if (/^\d{4}-\d{2}/.test(watchedAt)) {
    return watchedAt.slice(0, 7);
  }

  const shortDateMatch = watchedAt.match(/^([A-Za-z]{3})\s+(\d{2})$/);
  if (!shortDateMatch) {
    return '';
  }

  const month = shortMonthByName[shortDateMatch[1].toLowerCase()];
  return month ? `20${shortDateMatch[2]}-${month}` : '';
}

export function MovieRow({
  movie,
  showEnteredBy,
  onRemove,
  onMove,
  onUpdateNote,
  onUpdateWatchedAt,
  onUpdateEnteredBy,
  onUpdateTitle,
  onUpdateRottenTomatoesScores,
  onUpdateCategory,
  onUpdateMar,
  onUpdateBenji,
  targetStatus,
  columnVisibility,
}: MovieRowProps) {
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [isEditingEnteredBy, setIsEditingEnteredBy] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingScore, setEditingScore] = useState<'critics' | 'audience' | null>(null);
  const [noteValue, setNoteValue] = useState(movie.personalNote);
  const [enteredByValue, setEnteredByValue] = useState(movie.enteredBy || '');
  const [titleValue, setTitleValue] = useState(movie.title);
  const [scoreValue, setScoreValue] = useState('');
  const shouldSkipScoreBlurRef = useRef(false);
  const didCommitScoreRef = useRef(false);

  const handleSaveNote = () => {
    onUpdateNote(movie.id, noteValue);
    setIsEditingNote(false);
  };

  const handleCancelNote = () => {
    setNoteValue(movie.personalNote);
    setIsEditingNote(false);
  };

  const handleSaveEnteredBy = () => {
    onUpdateEnteredBy(movie.id, enteredByValue);
    setIsEditingEnteredBy(false);
  };

  const handleCancelEnteredBy = () => {
    setEnteredByValue(movie.enteredBy || '');
    setIsEditingEnteredBy(false);
  };

  const handleSaveTitle = () => {
    const nextTitle = titleValue.trim();
    if (nextTitle) {
      onUpdateTitle(movie.id, nextTitle);
    } else {
      setTitleValue(movie.title);
    }
    setIsEditingTitle(false);
  };

  const handleCancelTitle = () => {
    setTitleValue(movie.title);
    setIsEditingTitle(false);
  };

  const getRTColor = (score: number | null) => {
    if (score === null) return 'text-muted-foreground';
    if (score >= 75) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const rottenTomatoesUrl = movie.rtUrl || `https://www.rottentomatoes.com/search?search=${encodeURIComponent(movie.title)}`;
  const watchedMonth = getWatchedMonth(movie.watchedAt);
  const categoryOptions = movie.category && !categories.includes(movie.category)
    ? [movie.category, ...categories]
    : categories;

  const parseScore = (value: string) => {
    if (value === '') {
      return null;
    }

    const score = Number(value);
    return Number.isNaN(score) ? null : Math.max(0, Math.min(100, score));
  };

  const handleWatchedMonthChange = (value: string) => {
    onUpdateWatchedAt(movie.id, value ? `${value}-01T00:00:00.000Z` : '');
  };

  const startEditingScore = (type: 'critics' | 'audience') => {
    const score = type === 'critics' ? movie.rtCriticsScore : movie.rtAudienceScore;
    setScoreValue(score === null ? '' : String(score));
    didCommitScoreRef.current = false;
    setEditingScore(type);
  };

  const commitEditingScore = () => {
    if (shouldSkipScoreBlurRef.current) {
      shouldSkipScoreBlurRef.current = false;
      return;
    }

    if (!editingScore) return;
    if (didCommitScoreRef.current) return;
    didCommitScoreRef.current = true;

    const nextScore = parseScore(scoreValue);
    if (editingScore === 'critics') {
      onUpdateRottenTomatoesScores(movie.id, nextScore, movie.rtAudienceScore);
    } else {
      onUpdateRottenTomatoesScores(movie.id, movie.rtCriticsScore, nextScore);
    }
    setEditingScore(null);
  };

  const cancelEditingScore = () => {
    shouldSkipScoreBlurRef.current = true;
    didCommitScoreRef.current = true;
    setScoreValue('');
    setEditingScore(null);
  };

  const renderScore = (type: 'critics' | 'audience') => {
    const score = type === 'critics' ? movie.rtCriticsScore : movie.rtAudienceScore;
    const isEditing = editingScore === type;

    if (isEditing) {
      return (
        <Input
          type="number"
          min={0}
          max={100}
          value={scoreValue}
          onChange={(e) => setScoreValue(e.target.value)}
          onBlur={commitEditingScore}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commitEditingScore();
            }
            if (e.key === 'Escape') {
              cancelEditingScore();
            }
          }}
          className={`h-8 w-[72px] font-semibold ${getRTColor(score)}`}
          autoFocus
        />
      );
    }

    return (
      <button
        type="button"
        className={`text-sm font-semibold ${getRTColor(score)}`}
        onClick={() => startEditingScore(type)}
      >
        {score !== null ? `${score}%` : '—'}
      </button>
    );
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
      <TableCell className="font-medium">
        {isEditingTitle ? (
          <div className="flex items-center gap-1">
            <Input
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              className="h-8 min-w-[180px] text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveTitle();
                if (e.key === 'Escape') handleCancelTitle();
              }}
            />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleSaveTitle}>
              <Check className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCancelTitle}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 group">
            <a
              href={rottenTomatoesUrl}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline-offset-4 hover:underline"
            >
              {movie.title}
            </a>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100"
              onClick={() => {
                setTitleValue(movie.title);
                setIsEditingTitle(true);
              }}
            >
              <Edit2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </TableCell>
      {columnVisibility.year && (
        <TableCell>{movie.year || 'N/A'}</TableCell>
      )}
      {showEnteredBy && (
        <TableCell>
          {isEditingEnteredBy ? (
            <div className="flex items-center gap-1">
              <Input
                value={enteredByValue}
                onChange={(e) => setEnteredByValue(e.target.value)}
                className="h-8 w-[90px] text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEnteredBy();
                  if (e.key === 'Escape') handleCancelEnteredBy();
                }}
              />
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleSaveEnteredBy}>
                <Check className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCancelEnteredBy}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div
              className="flex items-center gap-2 cursor-pointer group"
              onClick={() => setIsEditingEnteredBy(true)}
            >
              <span className="min-h-5 min-w-8 text-sm">
                {movie.enteredBy || ''}
              </span>
              <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-100 text-muted-foreground" />
            </div>
          )}
        </TableCell>
      )}
      {columnVisibility.category && (
        <TableCell>
          <Select
            value={movie.category || 'film'}
            onValueChange={(value) => onUpdateCategory(movie.id, value)}
          >
            <SelectTrigger className="h-8 w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categoryOptions.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>
      )}
      {columnVisibility.whereToWatch && (
        <TableCell className="text-sm text-muted-foreground">
          {movie.whereToWatch || '—'}
        </TableCell>
      )}
      {columnVisibility.rtScores && (
        <>
          <TableCell>{renderScore('critics')}</TableCell>
          <TableCell>{renderScore('audience')}</TableCell>
        </>
      )}
      <TableCell>
        {isEditingNote ? (
          <div className="flex items-center gap-1">
            <Input
              value={noteValue}
              onChange={(e) => setNoteValue(e.target.value)}
              className="h-8 text-sm"
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
            <span className="min-h-5 min-w-8 text-sm">
              {movie.personalNote || ''}
            </span>
            <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-100 text-muted-foreground" />
          </div>
        )}
      </TableCell>
      {targetStatus === 'toWatch' && (
        <TableCell>
          <Input
            type="month"
            value={watchedMonth}
            onChange={(e) => handleWatchedMonthChange(e.target.value)}
            className="h-8 w-[130px]"
          />
        </TableCell>
      )}
      {columnVisibility.mar && (
        <TableCell>
          <Checkbox
            checked={Boolean(movie.mar)}
            onCheckedChange={(checked) => onUpdateMar(movie.id, Boolean(checked))}
            aria-label={`Mar a vu ${movie.title}`}
          />
        </TableCell>
      )}
      {columnVisibility.benji && (
        <TableCell>
          <Checkbox
            checked={Boolean(movie.benji)}
            onCheckedChange={(checked) => onUpdateBenji(movie.id, Boolean(checked))}
            aria-label={`Benji a vu ${movie.title}`}
          />
        </TableCell>
      )}
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

