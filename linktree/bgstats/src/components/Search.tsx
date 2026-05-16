import { useState, useEffect, useRef } from 'react';
import { searchGames, getGameDetails } from '../services/bgg';
import type { BGGGame, GameDetails } from '../services/bgg';

interface SearchProps {
    onAddGame: (game: GameDetails) => void;
}

export const Search = ({ onAddGame }: SearchProps) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<BGGGame[]>([]);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const timer = setTimeout(async () => {
            if (query.length >= 3) {
                setLoading(true);
                try {
                    const games = await searchGames(query);
                    setResults(games.slice(0, 10)); // Limit to 10 results
                    setIsOpen(true);
                } catch (error) {
                    console.error('Search failed', error);
                } finally {
                    setLoading(false);
                }
            } else {
                setResults([]);
                setIsOpen(false);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [query]);

    const handleAdd = async (id: string) => {
        setLoading(true);
        try {
            const details = await getGameDetails([id]);
            if (details.length > 0) {
                onAddGame(details[0]);
                setQuery('');
                setIsOpen(false);
            }
        } catch (error) {
            console.error('Failed to fetch details', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="search-container" ref={wrapperRef}>
            <div className="search-input-wrapper">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search board games or scan barcode..."
                    className="search-input"
                />
                {loading && <div className="spinner"></div>}
            </div>

            {isOpen && results.length > 0 && (
                <div className="search-results">
                    {results.map((game) => (
                        <div key={game.id} className="search-item" onClick={() => handleAdd(game.id)}>
                            <span className="game-name">{game.name}</span>
                            {game.yearPublished && <span className="game-year">({game.yearPublished})</span>}
                            <button className="add-btn" onClick={(e) => {
                                e.stopPropagation();
                                handleAdd(game.id);
                            }}>+</button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
