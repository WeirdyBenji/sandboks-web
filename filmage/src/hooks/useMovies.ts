import { useState, useEffect } from 'react';
import { Movie } from '@/types/movie';

const SHEETS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzlXCD3i-NuQMIn-BJ8Xk7DhyPBCML8o7lxtUheAX3EJ-1WVdVNKa9Wh_-fU1Zp63wl/exec';

interface MoviesResponse {
  movies?: Movie[];
  capabilities?: {
    addMovie?: boolean;
    deleteMovie?: boolean;
    updateMovie?: boolean;
  };
}

async function loadMoviesFromSheet(): Promise<MoviesResponse> {
  const response = await fetch(SHEETS_WEB_APP_URL);

  if (!response.ok) {
    throw new Error(`Failed to load movies from Google Sheets (${response.status})`);
  }

  return response.json();
}

async function postToSheet(body: unknown) {
  await fetch(SHEETS_WEB_APP_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: {
      'Content-Type': 'text/plain',
    },
    body: JSON.stringify(body),
  });
}

async function updateMovieInSheet(id: string, changes: Partial<Movie>) {
  await postToSheet({
    action: 'updateMovie',
    id,
    changes,
  });
}

async function addMovieToSheet(movie: Movie) {
  await postToSheet({
    action: 'addMovie',
    movie,
  });
}

async function deleteMovieFromSheet(id: string) {
  await postToSheet({
    action: 'deleteMovie',
    id,
  });
}

function getRottenTomatoesSearchUrl(title: string) {
  return `https://www.rottentomatoes.com/search?search=${encodeURIComponent(title)}`;
}

const cesarTitles = new Set([
  'anora',
  'borgo',
  'bye bye tibériade',
  'dahomey',
  'diamant brut',
  'emilia pérez',
  'en fanfare',
  'ernest cole, photographe',
  "flow, le chat qui n'avait plus peur de l'eau",
  "l'amour ouf",
  "l'histoire de souleymane",
  'la belle de gaza',
  'la bête',
  'la ferme des bertrand',
  'la plus précieuse des marchandises',
  "la zone d'intérêt",
  'le comte de monte-cristo',
  'le roman de jim',
  'le royaume',
  'les fantômes',
  'les graines du figuier sauvage',
  'madame hofmann',
  'miséricorde',
  'monsieur aznavour',
  'planète b',
  'quand vient l’automne',
  "quand vient l'automne",
  'rabia',
  'sarah bernhardt, la divine',
  'sauvages',
  'the apprentice',
  'the substance',
  "un p'tit truc en plus",
  'vingt dieux',
]);

const timBurtonTitles = new Set([
  'batman',
  'beetlejuice',
  'big fish',
  'corpse bride',
  'ed wood',
  'edward scissorhands',
  'sleepy hollow',
  'sweeney todd: the demon barber of fleet street',
]);

const bongJoonHoTitles = new Set([
  'memories of murder',
  'mickey 17',
  'mother',
  'okja',
  'parasite',
  'snowpiercer',
  'the host',
]);

function normalizeTitle(title: string) {
  return title.trim().toLowerCase();
}

function getDefaultCategory(movie: Movie) {
  const title = normalizeTitle(movie.title);

  if (title === 'psycho-pass 2') return 'anime';
  if (timBurtonTitles.has(title)) return 'tim burton';
  if (bongJoonHoTitles.has(title)) return 'bong joon ho';
  if (cesarTitles.has(title)) return 'césar';
  return 'film';
}

function getMediaType(movie: Movie) {
  return movie.mediaType || (movie.category === 'série' ? 'tv' : 'movie');
}

function normalizeMovie(movie: Movie): Movie {
  return {
    ...movie,
    mediaType: getMediaType(movie),
    whereToWatch: movie.whereToWatch || '',
    rtUrl: movie.rtUrl || getRottenTomatoesSearchUrl(movie.title),
    category: movie.category || getDefaultCategory(movie),
    mar: Boolean(movie.mar),
    benji: Boolean(movie.benji),
  };
}

function normalizeComparableValue(value: unknown) {
  if (value === null || value === undefined) {
    return '';
  }

  return value;
}

export function useMovies() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [capabilities, setCapabilities] = useState<MoviesResponse['capabilities']>({});

  useEffect(() => {
    let isMounted = true;

    loadMoviesFromSheet()
      .then((response) => {
        if (isMounted) {
          const loadedMovies = Array.isArray(response.movies) ? response.movies : [];
          setMovies(loadedMovies.map(normalizeMovie));
          setCapabilities(response.capabilities || {});
        }
      })
      .catch((error) => {
        console.error('Failed to load movies:', error);
      })
      .finally(() => {
        if (isMounted) {
          setIsLoaded(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const addMovie = (movie: Omit<Movie, 'id' | 'addedAt' | 'personalNote' | 'status'>, status: 'toWatch' | 'watched') => {
    if (!capabilities.addMovie) {
      console.error('Cannot add movie: Apps Script deployment does not support addMovie yet.');
      return;
    }

    const now = new Date().toISOString();
    const newMovie: Movie = {
      ...movie,
      id: crypto.randomUUID(),
      addedAt: now,
      watchedAt: status === 'watched' ? now : '',
      rtUrl: movie.rtUrl || getRottenTomatoesSearchUrl(movie.title),
      category: movie.category || 'film',
      mediaType: movie.mediaType || 'movie',
      mar: false,
      benji: false,
      personalNote: '',
      status,
    };
    setMovies(prev => [newMovie, ...prev]);
    addMovieToSheet(newMovie).catch((error) => {
      console.error('Failed to add movie:', error);
    });
  };

  const removeMovie = (id: string) => {
    if (!capabilities.deleteMovie) {
      console.error('Cannot remove movie: Apps Script deployment does not support deleteMovie yet.');
      return;
    }

    setMovies(prev => prev.filter(m => m.id !== id));
    deleteMovieFromSheet(id).catch((error) => {
      console.error('Failed to remove movie:', error);
    });
  };

  const updateMovieFields = (id: string, changes: Partial<Movie>) => {
    if (!capabilities.updateMovie) {
      console.error('Cannot update movie: Apps Script deployment does not support updateMovie yet.');
      return;
    }

    const movie = movies.find(m => m.id === id);
    if (!movie) return;

    const changedEntries = Object.entries(changes).filter(([field, value]) => {
      const currentValue = movie[field as keyof Movie];
      return normalizeComparableValue(currentValue) !== normalizeComparableValue(value);
    });

    if (changedEntries.length === 0) return;

    const changedFields = Object.fromEntries(changedEntries) as Partial<Movie>;

    setMovies(prev => prev.map(m =>
      m.id === id ? { ...m, ...changedFields } : m
    ));

    updateMovieInSheet(id, changedFields).catch((error) => {
      console.error('Failed to update movie:', error);
    });
  };

  const moveMovie = (id: string, newStatus: 'toWatch' | 'watched') => {
    const movie = movies.find(m => m.id === id);
    updateMovieFields(id, {
      status: newStatus,
      watchedAt: newStatus === 'watched' ? movie?.watchedAt || new Date().toISOString() : '',
    });
  };

  const updatePersonalNote = (id: string, note: string) => {
    updateMovieFields(id, { personalNote: note });
  };

  const updateWatchedAt = (id: string, watchedAt: string) => {
    updateMovieFields(id, { watchedAt });
  };

  const updateEnteredBy = (id: string, enteredBy: string) => {
    updateMovieFields(id, { enteredBy });
  };

  const updateTitle = (id: string, title: string) => {
    updateMovieFields(id, { title });
  };

  const updateRottenTomatoesScores = (id: string, rtCriticsScore: number | null, rtAudienceScore: number | null) => {
    updateMovieFields(id, { rtCriticsScore, rtAudienceScore });
  };

  const updateCategory = (id: string, category: string) => {
    updateMovieFields(id, { category });
  };

  const updateMar = (id: string, mar: boolean) => {
    updateMovieFields(id, { mar });
  };

  const updateBenji = (id: string, benji: boolean) => {
    updateMovieFields(id, { benji });
  };

  const isMovieInList = (tmdbId: number, mediaType: Movie['mediaType'] = 'movie') => {
    return movies.some(m => m.tmdbId === tmdbId && getMediaType(m) === mediaType);
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
    updateWatchedAt,
    updateEnteredBy,
    updateTitle,
    updateRottenTomatoesScores,
    updateCategory,
    updateMar,
    updateBenji,
    isMovieInList,
    isLoaded,
  };
}



