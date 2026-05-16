import { ReactNode, useState, useMemo } from 'react';
import { Movie, ColumnVisibility } from '@/types/movie';
import { MovieRow } from '@/components/MovieRow';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, ArrowUp, ArrowDown, Settings2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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

type SortField = 'addedAt' | 'rtCriticsScore' | 'rtAudienceScore' | 'year' | 'title' | 'category' | 'mar' | 'benji';
type SortOrder = 'asc' | 'desc';

interface MovieListProps {
  movies: Movie[];
  tabs: ReactNode;
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
  emptyMessage: string;
  columnVisibility: ColumnVisibility;
  onColumnVisibilityChange: (visibility: ColumnVisibility) => void;
}

export function MovieList({
  movies,
  tabs,
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
        case 'category':
          comparison = (a.category || '').localeCompare(b.category || '');
          break;
        case 'mar':
          comparison = Number(Boolean(a.mar)) - Number(Boolean(b.mar));
          break;
        case 'benji':
          comparison = Number(Boolean(a.benji)) - Number(Boolean(b.benji));
          break;
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }, [movies, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
      return;
    }

    setSortField(field);
    setSortOrder(field === 'title' || field === 'category' ? 'asc' : 'desc');
  };

  const renderSortableHeader = (field: SortField, label: string, className?: string) => {
    const isActive = sortField === field;
    const SortIcon = !isActive ? ArrowUpDown : sortOrder === 'desc' ? ArrowDown : ArrowUp;

    return (
      <TableHead className={className}>
        <Button
          variant="ghost"
          className="h-auto px-0 py-0 font-medium hover:bg-transparent"
          onClick={() => handleSort(field)}
        >
          {label}
          <SortIcon className="ml-1 h-3 w-3" />
        </Button>
      </TableHead>
    );
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
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {tabs}
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
                  <Label htmlFor="show-entered-by" className="text-sm">Entré par</Label>
                  <Switch
                    id="show-entered-by"
                    checked={columnVisibility.enteredBy}
                    onCheckedChange={(checked) => 
                      onColumnVisibilityChange({ ...columnVisibility, enteredBy: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="show-category" className="text-sm">Catégorie</Label>
                  <Switch
                    id="show-category"
                    checked={columnVisibility.category}
                    onCheckedChange={(checked) => 
                      onColumnVisibilityChange({ ...columnVisibility, category: checked })
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
                  <Label htmlFor="show-mar" className="text-sm">Mar</Label>
                  <Switch
                    id="show-mar"
                    checked={columnVisibility.mar}
                    onCheckedChange={(checked) => 
                      onColumnVisibilityChange({ ...columnVisibility, mar: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="show-benji" className="text-sm">Benji</Label>
                  <Switch
                    id="show-benji"
                    checked={columnVisibility.benji}
                    onCheckedChange={(checked) => 
                      onColumnVisibilityChange({ ...columnVisibility, benji: checked })
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
              {renderSortableHeader('title', 'Titre')}
              {columnVisibility.year && renderSortableHeader('year', 'Année', 'w-[80px]')}
              {columnVisibility.enteredBy && <TableHead className="w-[100px]">Entré par</TableHead>}
              {columnVisibility.category && renderSortableHeader('category', 'Catégorie', 'w-[130px]')}
              {columnVisibility.rtScores && (
                <>
                  {renderSortableHeader('rtCriticsScore', 'RT Critiques', 'w-[100px]')}
                  {renderSortableHeader('rtAudienceScore', 'RT Audience', 'w-[100px]')}
                </>
              )}
              <TableHead className="w-[200px]">Note personnelle</TableHead>
              {targetStatus === 'toWatch' && <TableHead className="w-[140px]">Vu en</TableHead>}
              {columnVisibility.mar && renderSortableHeader('mar', 'Mar', 'w-[70px]')}
              {columnVisibility.benji && renderSortableHeader('benji', 'Benji', 'w-[70px]')}
              {columnVisibility.actions && <TableHead className="w-[120px]">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedMovies.map((movie) => (
              <MovieRow
                key={movie.id}
                movie={movie}
                showEnteredBy={columnVisibility.enteredBy}
                onRemove={onRemove}
                onMove={onMove}
                onUpdateNote={onUpdateNote}
                onUpdateWatchedAt={onUpdateWatchedAt}
                onUpdateEnteredBy={onUpdateEnteredBy}
                onUpdateTitle={onUpdateTitle}
                onUpdateRottenTomatoesScores={onUpdateRottenTomatoesScores}
                onUpdateCategory={onUpdateCategory}
                onUpdateMar={onUpdateMar}
                onUpdateBenji={onUpdateBenji}
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
