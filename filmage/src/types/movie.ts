export interface Movie {
  id: string;
  tmdbId: number;
  mediaType?: 'movie' | 'tv';
  title: string;
  year: string;
  poster: string;
  rtUrl?: string;
  rtCriticsScore: number | null;
  rtAudienceScore: number | null;
  personalNote: string;
  addedAt: string;
  watchedAt?: string;
  enteredBy?: string;
  category?: string;
  mar?: boolean;
  benji?: boolean;
  status: 'toWatch' | 'watched';
}

export interface ColumnVisibility {
  poster: boolean;
  year: boolean;
  enteredBy: boolean;
  category: boolean;
  rtScores: boolean;
  mar: boolean;
  benji: boolean;
  actions: boolean;
}

export interface TMDbSearchResult {
  id: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path: string | null;
  overview: string;
  media_type?: 'movie' | 'tv';
}

export interface TMDbSearchResponse {
  results: TMDbSearchResult[];
  total_results: number;
}
