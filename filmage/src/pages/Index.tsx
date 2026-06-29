import { useState, useEffect } from 'react';
import { Film } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MovieSearch } from '@/components/MovieSearch';
import { MovieList } from '@/components/MovieList';
import { useMovies } from '@/hooks/useMovies';
import { ColumnVisibility } from '@/types/movie';

const COLUMN_VISIBILITY_KEY = 'movie-tracker-columns';

const defaultColumnVisibility: ColumnVisibility = {
  poster: true,
  year: false,
  enteredBy: false,
  category: true,
  whereToWatch: true,
  rtScores: true,
  mar: true,
  benji: true,
  actions: true,
};

const Index = () => {
  const {
    toWatchMovies,
    watchedMovies,
    addMovie,
    removeMovie,
    moveMovie,
    updatePersonalNote,
    updateWatchedAt,
    updateEnteredBy,
    updateTitle,
    updateRottenTomatoesScores,
    updateCategory,
    updateMar,
    updateBenji,
    isMovieInList,
    isLoaded,
  } = useMovies();

  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>(defaultColumnVisibility);

  useEffect(() => {
    const stored = localStorage.getItem(COLUMN_VISIBILITY_KEY);
    if (stored) {
      try {
        setColumnVisibility({ ...defaultColumnVisibility, ...JSON.parse(stored) });
      } catch (e) {
        console.error('Failed to parse column visibility:', e);
      }
    }
  }, []);

  const handleColumnVisibilityChange = (visibility: ColumnVisibility) => {
    setColumnVisibility(visibility);
    localStorage.setItem(COLUMN_VISIBILITY_KEY, JSON.stringify(visibility));
  };

  const tabs = (
    <TabsList>
      <TabsTrigger value="toWatch" className="gap-2">
        À voir
        {toWatchMovies.length > 0 && (
          <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs">
            {toWatchMovies.length}
          </span>
        )}
      </TabsTrigger>
      <TabsTrigger value="watched" className="gap-2">
        Vus
        {watchedMovies.length > 0 && (
          <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs">
            {watchedMovies.length}
          </span>
        )}
      </TabsTrigger>
    </TabsList>
  );

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Film className="h-8 w-8 animate-pulse text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Film className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">Movie Tracker</h1>
            </div>
            <MovieSearch onAddMovie={addMovie} isMovieInList={isMovieInList} />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="toWatch" className="w-full">
          <TabsContent value="toWatch">
            <MovieList
              movies={toWatchMovies}
              tabs={tabs}
              onRemove={removeMovie}
              onMove={moveMovie}
              onUpdateNote={updatePersonalNote}
              onUpdateWatchedAt={updateWatchedAt}
              onUpdateEnteredBy={updateEnteredBy}
              onUpdateTitle={updateTitle}
              onUpdateRottenTomatoesScores={updateRottenTomatoesScores}
              onUpdateCategory={updateCategory}
              onUpdateMar={updateMar}
              onUpdateBenji={updateBenji}
              targetStatus="watched"
              emptyMessage="Aucun film à voir. Utilisez la recherche pour en ajouter !"
              columnVisibility={columnVisibility}
              onColumnVisibilityChange={handleColumnVisibilityChange}
            />
          </TabsContent>

          <TabsContent value="watched">
            <MovieList
              movies={watchedMovies}
              tabs={tabs}
              onRemove={removeMovie}
              onMove={moveMovie}
              onUpdateNote={updatePersonalNote}
              onUpdateWatchedAt={updateWatchedAt}
              onUpdateEnteredBy={updateEnteredBy}
              onUpdateTitle={updateTitle}
              onUpdateRottenTomatoesScores={updateRottenTomatoesScores}
              onUpdateCategory={updateCategory}
              onUpdateMar={updateMar}
              onUpdateBenji={updateBenji}
              targetStatus="toWatch"
              emptyMessage="Aucun film vu pour l'instant."
              columnVisibility={columnVisibility}
              onColumnVisibilityChange={handleColumnVisibilityChange}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
