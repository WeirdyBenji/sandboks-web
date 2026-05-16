import { useState, useEffect, useRef } from 'react';
import { Search, Plus, Check, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { TMDbSearchResult } from '@/types/movie';
import { searchMovies, getRottenTomatoesScores, getPosterUrl } from '@/lib/movieApi';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface MovieSearchProps {
  onAddMovie: (movie: {
    tmdbId: number;
    title: string;
    year: string;
    poster: string;
    rtCriticsScore: number | null;
    rtAudienceScore: number | null;
  }, status: 'toWatch' | 'watched') => void;
  isMovieInList: (tmdbId: number) => boolean;
}

export function MovieSearch({ onAddMovie, isMovieInList }: MovieSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TMDbSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [addingId, setAddingId] = useState<number | null>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      const searchResults = await searchMovies(query);
      setResults(searchResults);
      setIsSearching(false);
      if (searchResults.length > 0) {
        setIsOpen(true);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

  const handleAddMovie = async (movie: TMDbSearchResult, status: 'toWatch' | 'watched') => {
    setAddingId(movie.id);
    
    const year = movie.release_date ? movie.release_date.split('-')[0] : '';
    const rtScores = await getRottenTomatoesScores(movie.title, year);
    
    onAddMovie({
      tmdbId: movie.id,
      title: movie.title,
      year,
      poster: getPosterUrl(movie.poster_path),
      rtCriticsScore: rtScores.critics,
      rtAudienceScore: rtScores.audience,
    }, status);
    
    setAddingId(null);
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  return (
    <div className="relative w-full max-w-xl">
      <Popover open={isOpen && results.length > 0} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un film..."
              className="pl-10 pr-10"
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandList>
              <CommandEmpty>Aucun film trouvé</CommandEmpty>
              <CommandGroup>
                {results.map((movie) => {
                  const inList = isMovieInList(movie.id);
                  const year = movie.release_date ? movie.release_date.split('-')[0] : 'N/A';
                  
                  return (
                    <CommandItem
                      key={movie.id}
                      className="flex items-center gap-3 p-2"
                      disabled={inList || addingId === movie.id}
                    >
                      <img
                        src={getPosterUrl(movie.poster_path)}
                        alt={movie.title}
                        className="h-12 w-8 rounded object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{movie.title}</p>
                        <p className="text-sm text-muted-foreground">{year}</p>
                      </div>
                      {inList ? (
                        <Check className="h-4 w-4 text-muted-foreground" />
                      ) : addingId === movie.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAddMovie(movie, 'toWatch')}
                            className="text-xs h-7 px-2"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            À voir
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleAddMovie(movie, 'watched')}
                            className="text-xs h-7 px-2"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Vu
                          </Button>
                        </div>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
