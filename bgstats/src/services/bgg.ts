export interface BGGGame {
  id: string;
  name: string;
  yearPublished?: string;
}

export interface GameDetails extends BGGGame {
  thumbnail: string;
  image: string;
  description: string;
  rank: number;
  averageRating: number;
  weight: number;
  minPlaytime: number;
  maxPlaytime: number;
  minAge: number;
  minPlayers: number;
  maxPlayers: number;
  barcode?: string;
  owner?: string;
  communityBestPlayers?: string;
  communityRecPlayers?: string;
  communityMinAge?: number;
}

const BASE_URL = 'https://boardgamegeek.com/xmlapi2';

export const searchGames = async (query: string): Promise<BGGGame[]> => {
  if (!query) return [];

  // Check if query looks like a barcode (digits only, length > 8)
  const isBarcode = /^\d{8,}$/.test(query);
  const searchUrl = `${BASE_URL}/search?query=${encodeURIComponent(query)}&type=boardgame${isBarcode ? '&exact=1' : ''}`;

  const response = await fetch(searchUrl, {
    headers: {
      Authorization: 'Bearer 5105d1d3-d760-491f-b867-6bd28d510217',
    },
  });
  const text = await response.text();
  const parser = new DOMParser();
  const xml = parser.parseFromString(text, 'text/xml');

  const items = Array.from(xml.querySelectorAll('item'));
  return items.map(item => ({
    id: item.getAttribute('id') || '',
    name: item.querySelector('name')?.getAttribute('value') || 'Unknown',
    yearPublished: item.querySelector('yearpublished')?.getAttribute('value') || undefined,
  }));
};

export const getGameDetails = async (ids: string[]): Promise<GameDetails[]> => {
  if (ids.length === 0) return [];
  const response = await fetch(`${BASE_URL}/thing?id=${ids.join(',')}&stats=1`, {
    headers: {
      Authorization: 'Bearer 5105d1d3-d760-491f-b867-6bd28d510217',
    },
  });
  const text = await response.text();
  const parser = new DOMParser();
  const xml = parser.parseFromString(text, 'text/xml');

  const items = Array.from(xml.querySelectorAll('item'));
  return items.map(item => {
    const name = item.querySelector('name[type="primary"]')?.getAttribute('value') || 'Unknown';
    const rankNode = item.querySelector('statistics ratings ranks rank[name="boardgame"]');
    const rank = rankNode?.getAttribute('value');

    // Parse suggested_numplayers poll
    let communityBestPlayers = '';
    let communityRecPlayers = '';
    const numPlayersPoll = item.querySelector('poll[name="suggested_numplayers"]');
    if (numPlayersPoll) {
      const results = Array.from(numPlayersPoll.querySelectorAll('results'));
      let bestPlayerCounts: string[] = [];
      let recPlayerCounts: string[] = [];

      results.forEach(res => {
        const numPlayers = res.getAttribute('numplayers') || '';
        const bestVotes = parseInt(res.querySelector('result[value="Best"]')?.getAttribute('numvotes') || '0');
        const recVotes = parseInt(res.querySelector('result[value="Recommended"]')?.getAttribute('numvotes') || '0');
        const notRecVotes = parseInt(res.querySelector('result[value="Not Recommended"]')?.getAttribute('numvotes') || '0');
        const totalVotes = bestVotes + recVotes + notRecVotes;

        if (totalVotes > 0) {
          if (bestVotes / totalVotes >= 0.5) {
            bestPlayerCounts.push(numPlayers);
          }

          if ((bestVotes + recVotes) / totalVotes >= 0.5) {
            recPlayerCounts.push(numPlayers);
          }
        }
      });

      communityBestPlayers = bestPlayerCounts.join(', ');

      // Format recommended range
      if (recPlayerCounts.length > 0) {
        // Simple join for now, could be improved to show ranges (e.g. "2-4")
        // If numeric, we could sort and range-ify.
        // Given BGG data usually is ordered, let's try to make it a range if possible or just comma separated.
        // For simplicity and robustness, comma separated is fine, or just first and last if contiguous.
        // Let's stick to comma separated for now to be safe.
        communityRecPlayers = recPlayerCounts.join(', ');
      }
    }

    // Parse suggested_playerage poll
    let communityMinAge = 0;
    const agePoll = item.querySelector('poll[name="suggested_playerage"]');
    if (agePoll) {
      const results = Array.from(agePoll.querySelectorAll('result'));
      let maxVotes = -1;
      results.forEach(res => {
        const age = parseInt(res.getAttribute('value') || '0');
        const votes = parseInt(res.getAttribute('numvotes') || '0');
        if (votes > maxVotes) {
          maxVotes = votes;
          communityMinAge = age;
        }
      });
    }

    return {
      id: item.getAttribute('id') || '',
      name,
      yearPublished: item.querySelector('yearpublished')?.getAttribute('value') || undefined,
      thumbnail: item.querySelector('thumbnail')?.textContent || '',
      image: item.querySelector('image')?.textContent || '',
      description: item.querySelector('description')?.textContent || '',
      rank: rank && rank !== 'Not Ranked' ? parseInt(rank) : 0,
      averageRating: parseFloat(item.querySelector('statistics ratings average')?.getAttribute('value') || '0'),
      weight: parseFloat(item.querySelector('statistics ratings averageweight')?.getAttribute('value') || '0'),
      minPlaytime: parseInt(item.querySelector('minplaytime')?.getAttribute('value') || '0'),
      maxPlaytime: parseInt(item.querySelector('maxplaytime')?.getAttribute('value') || '0'),
      minAge: parseInt(item.querySelector('minage')?.getAttribute('value') || '0'),
      minPlayers: parseInt(item.querySelector('minplayers')?.getAttribute('value') || '0'),
      maxPlayers: parseInt(item.querySelector('maxplayers')?.getAttribute('value') || '0'),
      communityBestPlayers,
      communityRecPlayers,
      communityMinAge,
    };
  });
};
