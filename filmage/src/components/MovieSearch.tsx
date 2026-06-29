import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Plus, Check, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { TMDbSearchResult } from '@/types/movie';
import { searchMovies, getRottenTomatoesScores, getPosterUrl, getResultTitle, getResultYear, getWhereToWatch } from '@/lib/movieApi';
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
    whereToWatch?: string;
    rtCriticsScore: number | null;
    rtAudienceScore: number | null;
    rtUrl?: string;
    category?: string;
    mediaType?: 'movie' | 'tv';
  }, status: 'toWatch' | 'watched') => void;
  isMovieInList: (tmdbId: number, mediaType?: 'movie' | 'tv') => boolean;
}

export function MovieSearch({ onAddMovie, isMovieInList }: MovieSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TMDbSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  const executeSearch = useCallback(async (searchQuery: string) => {
    const normalizedQuery = searchQuery.trim();

    if (normalizedQuery.length < 2) {
      setResults([]);
      setIsOpen(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const searchResults = await searchMovies(normalizedQuery);
    setResults(searchResults);
    setIsSearching(false);
    setIsOpen(searchResults.length > 0);
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceRef.current = setTimeout(() => {
      void executeSearch(query);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [executeSearch, query]);

  const handleAddMovie = async (movie: TMDbSearchResult, status: 'toWatch' | 'watched') => {
    const mediaType = movie.media_type === 'tv' ? 'tv' : 'movie';
    const resultKey = `${mediaType}:${movie.id}`;
    setAddingId(resultKey);

    const title = getResultTitle(movie);
    const year = getResultYear(movie);
    const [rtScores, whereToWatch] = await Promise.all([
      mediaType === 'movie'
        ? getRottenTomatoesScores(title, year)
        : Promise.resolve({ critics: null, audience: null }),
      getWhereToWatch(movie.id, mediaType),
    ]);

    onAddMovie({
      tmdbId: movie.id,
      mediaType,
      title,
      year,
      poster: getPosterUrl(movie.poster_path),
      whereToWatch,
      rtCriticsScore: rtScores.critics,
      rtAudienceScore: rtScores.audience,
      rtUrl: `https://www.rottentomatoes.com/search?search=${encodeURIComponent(title)}`,
      category: mediaType === 'tv' ? 'série' : 'film',
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
              onKeyDown={(e) => {
                if (e.key !== 'Enter') {
                  return;
                }

                e.preventDefault();
                if (debounceRef.current) {
                  clearTimeout(debounceRef.current);
                }
                void executeSearch(query);
              }}
              placeholder="Rechercher un film ou une série..."
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
              <CommandEmpty>Aucun film ou série trouvé</CommandEmpty>
              <CommandGroup>
                {results.map((movie) => {
                  const mediaType = movie.media_type === 'tv' ? 'tv' : 'movie';
                  const resultKey = `${mediaType}:${movie.id}`;
                  const inList = isMovieInList(movie.id, mediaType);
                  const title = getResultTitle(movie);
                  const year = getResultYear(movie) || 'N/A';

                  return (
                    <CommandItem
                      key={resultKey}
                      className="flex items-center gap-3 p-2"
                      disabled={inList || addingId === resultKey}
                    >
                      <img
                        src={getPosterUrl(movie.poster_path)}
                        alt={title}
                        className="h-12 w-8 rounded object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{title}</p>
                        <p className="text-sm text-muted-foreground">
                          {year} · {movie.media_type === 'tv' ? 'Série' : 'Film'}
                        </p>
                      </div>
                      {inList ? (
                        <Check className="h-4 w-4 text-muted-foreground" />
                      ) : addingId === resultKey ? (
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
