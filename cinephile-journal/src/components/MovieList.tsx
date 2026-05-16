import { useState, useMemo } from 'react';
import { Movie, ColumnVisibility } from '@/types/movie';
import { MovieRow } from '@/components/MovieRow';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, ArrowUp, ArrowDown, Settings2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

type SortField = 'addedAt' | 'rtCriticsScore' | 'rtAudienceScore' | 'year' | 'title';
type SortOrder = 'asc' | 'desc';

interface MovieListProps {
  movies: Movie[];
  onRemove: (id: string) => void;
  onMove: (id: string, status: 'toWatch' | 'watched') => void;
  onUpdateNote: (id: string, note: string) => void;
  targetStatus: 'toWatch' | 'watched';
  emptyMessage: string;
  columnVisibility: ColumnVisibility;
  onColumnVisibilityChange: (visibility: ColumnVisibility) => void;
}

export function MovieList({
  movies,
  onRemove,
  onMove,
  onUpdateNote,
  targetStatus,
  emptyMessage,
  columnVisibility,
  onColumnVisibilityChange,
}: MovieListProps) {
  const [sortField, setSortField] = useState<SortField>('addedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const sortedMovies = useMemo(() => {
    return [...movies].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'addedAt':
          comparison = new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime();
          break;
        case 'rtCriticsScore':
          const criticsA = a.rtCriticsScore ?? -1;
          const criticsB = b.rtCriticsScore ?? -1;
          comparison = criticsA - criticsB;
          break;
        case 'rtAudienceScore':
          const audienceA = a.rtAudienceScore ?? -1;
          const audienceB = b.rtAudienceScore ?? -1;
          comparison = audienceA - audienceB;
          break;
        case 'year':
          comparison = (a.year || '0').localeCompare(b.year || '0');
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }, [movies, sortField, sortOrder]);

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  if (movies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">Trier par :</span>
        <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="addedAt">Date d'ajout</SelectItem>
            <SelectItem value="rtCriticsScore">Note RT Critiques</SelectItem>
            <SelectItem value="rtAudienceScore">Note RT Audience</SelectItem>
            <SelectItem value="year">Année</SelectItem>
            <SelectItem value="title">Titre</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" onClick={toggleSortOrder}>
          {sortOrder === 'desc' ? (
            <ArrowDown className="h-4 w-4" />
          ) : (
            <ArrowUp className="h-4 w-4" />
          )}
        </Button>
        <span className="text-sm text-muted-foreground ml-2">
          {movies.length} film{movies.length > 1 ? 's' : ''}
        </span>
        
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="ml-auto">
              <Settings2 className="h-4 w-4 mr-2" />
              Colonnes
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56" align="end">
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Afficher les colonnes</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="show-poster" className="text-sm">Affiche</Label>
                  <Switch
                    id="show-poster"
                    checked={columnVisibility.poster}
                    onCheckedChange={(checked) => 
                      onColumnVisibilityChange({ ...columnVisibility, poster: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="show-year" className="text-sm">Année</Label>
                  <Switch
                    id="show-year"
                    checked={columnVisibility.year}
                    onCheckedChange={(checked) => 
                      onColumnVisibilityChange({ ...columnVisibility, year: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="show-rt" className="text-sm">Notes RT</Label>
                  <Switch
                    id="show-rt"
                    checked={columnVisibility.rtScores}
                    onCheckedChange={(checked) => 
                      onColumnVisibilityChange({ ...columnVisibility, rtScores: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="show-actions" className="text-sm">Actions</Label>
                  <Switch
                    id="show-actions"
                    checked={columnVisibility.actions}
                    onCheckedChange={(checked) => 
                      onColumnVisibilityChange({ ...columnVisibility, actions: checked })
                    }
                  />
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columnVisibility.poster && <TableHead className="w-[60px]">Affiche</TableHead>}
              <TableHead>Titre</TableHead>
              {columnVisibility.year && <TableHead className="w-[80px]">Année</TableHead>}
              {columnVisibility.rtScores && (
                <>
                  <TableHead className="w-[80px]">RT Critiques</TableHead>
                  <TableHead className="w-[80px]">RT Audience</TableHead>
                </>
              )}
              <TableHead className="w-[200px]">Note personnelle</TableHead>
              {columnVisibility.actions && <TableHead className="w-[120px]">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedMovies.map((movie) => (
              <MovieRow
                key={movie.id}
                movie={movie}
                onRemove={onRemove}
                onMove={onMove}
                onUpdateNote={onUpdateNote}
                targetStatus={targetStatus}
                columnVisibility={columnVisibility}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
