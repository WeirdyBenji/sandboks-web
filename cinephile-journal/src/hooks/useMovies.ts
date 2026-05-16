import { useState, useEffect } from 'react';
import { Movie } from '@/types/movie';

const STORAGE_KEY = 'movie-tracker-data';

export function useMovies() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setMovies(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse stored movies:', e);
      }
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage whenever movies change
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(movies));
    }
  }, [movies, isLoaded]);

  const addMovie = (movie: Omit<Movie, 'id' | 'addedAt' | 'personalNote' | 'status'>, status: 'toWatch' | 'watched') => {
    const newMovie: Movie = {
      ...movie,
      id: crypto.randomUUID(),
      addedAt: new Date().toISOString(),
      personalNote: '',
      status,
    };
    setMovies(prev => [newMovie, ...prev]);
  };

  const removeMovie = (id: string) => {
    setMovies(prev => prev.filter(m => m.id !== id));
  };

  const moveMovie = (id: string, newStatus: 'toWatch' | 'watched') => {
    setMovies(prev => prev.map(m => 
      m.id === id ? { ...m, status: newStatus } : m
    ));
  };

  const updatePersonalNote = (id: string, note: string) => {
    setMovies(prev => prev.map(m => 
      m.id === id ? { ...m, personalNote: note } : m
    ));
  };

  const isMovieInList = (tmdbId: number) => {
    return movies.some(m => m.tmdbId === tmdbId);
  };

  const toWatchMovies = movies.filter(m => m.status === 'toWatch');
  const watchedMovies = movies.filter(m => m.status === 'watched');

  return {
    movies,
    toWatchMovies,
    watchedMovies,
    addMovie,
    removeMovie,
    moveMovie,
    updatePersonalNote,
    isMovieInList,
    isLoaded,
  };
}
