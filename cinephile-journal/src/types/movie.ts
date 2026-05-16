export interface Movie {
  id: string;
  tmdbId: number;
  title: string;
  year: string;
  poster: string;
  rtCriticsScore: number | null;
  rtAudienceScore: number | null;
  personalNote: string;
  addedAt: string;
  status: 'toWatch' | 'watched';
}

export interface ColumnVisibility {
  poster: boolean;
  year: boolean;
  rtScores: boolean;
  actions: boolean;
}

export interface TMDbSearchResult {
  id: number;
  title: string;
  release_date: string;
  poster_path: string | null;
  overview: string;
}

export interface TMDbSearchResponse {
  results: TMDbSearchResult[];
  total_results: number;
}
