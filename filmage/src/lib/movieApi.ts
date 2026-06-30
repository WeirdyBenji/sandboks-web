import { TMDbSearchResponse, TMDbSearchResult } from '@/types/movie';

// TMDb API - Free tier with attribution
const TMDB_API_KEY = import.meta.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w92';

// OMDb API for Rotten Tomatoes scores - Free tier
const OMDB_API_KEY = '4a3b711b';
const OMDB_BASE_URL = 'https://www.omdbapi.com';

const STREAMING_PROVIDER_PRIORITY = [
  { providerName: 'Netflix', label: 'Netflix' },
  { providerName: 'Amazon Prime Video', label: 'Prime Video' },
  { providerName: 'Disney Plus', label: 'Disney+' },
  { providerName: 'Disney+', label: 'Disney+' },
  { providerName: 'HBO Max', label: 'HBO' },
  { providerName: 'Max', label: 'HBO' },
  { providerName: 'Hulu', label: 'Hulu' },
] as const;

interface TMDbWatchProvider {
  provider_name: string;
}

interface TMDbWatchProviderRegion {
  flatrate?: TMDbWatchProvider[];
}

interface TMDbWatchProvidersResponse {
  results?: {
    FR?: TMDbWatchProviderRegion;
  };
}

export async function searchMovies(query: string): Promise<TMDbSearchResult[]> {
  if (!query.trim()) return [];
  if (!TMDB_API_KEY) return [];

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=fr-FR`
    );

    if (!response.ok) throw new Error('Search failed');

    const data: TMDbSearchResponse = await response.json();
    return data.results
      .filter((result) => result.media_type === 'movie' || result.media_type === 'tv')
      .slice(0, 8);
  } catch (error) {
    console.error('Error searching movies:', error);
    return [];
  }
}

export function getResultTitle(result: TMDbSearchResult): string {
  return result.title || result.name || '';
}

export function getResultYear(result: TMDbSearchResult): string {
  const date = result.release_date || result.first_air_date || '';
  return date ? date.split('-')[0] : '';
}

export interface RTScores {
  critics: number | null;
  audience: number | null;
}

export async function getRottenTomatoesScores(title: string, year: string): Promise<RTScores> {
  try {
    const response = await fetch(
      `${OMDB_BASE_URL}/?apikey=${OMDB_API_KEY}&t=${encodeURIComponent(title)}&y=${year}&tomatoes=true`
    );

    if (!response.ok) throw new Error('OMDb request failed');

    const data = await response.json();

    let criticsScore: number | null = null;
    let audienceScore: number | null = null;

    // Get critics score from Ratings array
    if (data.Ratings) {
      const rtRating = data.Ratings.find((r: { Source: string; Value: string }) =>
        r.Source === 'Rotten Tomatoes'
      );
      if (rtRating) {
        criticsScore = parseInt(rtRating.Value.replace('%', ''), 10);
      }
    }

    // Get audience score from tomatoUserMeter (if available with tomatoes=true)
    if (data.tomatoUserMeter && data.tomatoUserMeter !== 'N/A') {
      audienceScore = parseInt(data.tomatoUserMeter, 10);
    }

    return { critics: criticsScore, audience: audienceScore };
  } catch (error) {
    console.error('Error fetching RT scores:', error);
    return { critics: null, audience: null };
  }
}

export async function getWhereToWatch(tmdbId: number, mediaType: 'movie' | 'tv'): Promise<string> {
  if (!TMDB_API_KEY) return '';

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/${mediaType}/${tmdbId}/watch/providers?api_key=${TMDB_API_KEY}`
    );

    if (!response.ok) throw new Error('TMDb watch providers request failed');

    const data: TMDbWatchProvidersResponse = await response.json();
    const flatrateProviders = data.results?.FR?.flatrate || [];

    if (flatrateProviders.length === 0) {
      return '';
    }

    const availableProviders = new Set(flatrateProviders.map((provider) => provider.provider_name));
    const prioritizedProviders = STREAMING_PROVIDER_PRIORITY.reduce<string[]>((providers, entry) => {
      if (availableProviders.has(entry.providerName) && !providers.includes(entry.label)) {
        providers.push(entry.label);
      }

      return providers;
    }, []);

    return prioritizedProviders.join(', ');
  } catch (error) {
    console.error('Error fetching watch providers:', error);
    return '';
  }
}

export function getPosterUrl(posterPath: string | null): string {
  if (!posterPath) return '/placeholder.svg';
  return `${TMDB_IMAGE_BASE}${posterPath}`;
}


