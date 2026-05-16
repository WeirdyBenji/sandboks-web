import { useState, useEffect } from 'react';
import { Search } from './components/Search';
import { GameTable } from './components/GameTable';
import { getSavedGames, saveGame, removeGame, seedDatabase } from './services/storage';
import type { GameDetails } from './services/bgg';

function App() {
  const [games, setGames] = useState<GameDetails[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark' | 'system') || 'system';
  });

  const [visibleColumns, setVisibleColumns] = useState({
    image: false,
    year: false,
    delete: false,
    barcode: true,
    owner: true,
    edit: false,
    communityBestPlayers: false,
    communityRecPlayers: false,
    communityMinAge: false,
  });
  const [showSettings, setShowSettings] = useState(false);
  const [isAddingGame, setIsAddingGame] = useState(false);

  useEffect(() => {
    setGames(getSavedGames());
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const effectiveTheme = theme === 'system' ? systemTheme : theme;

    root.classList.remove('light', 'dark');
    root.classList.add(effectiveTheme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const handleAddGame = (game: GameDetails) => {
    saveGame(game);
    setGames(getSavedGames());
  };

  const handleRemoveGame = (id: string) => {
    removeGame(id);
    setGames(getSavedGames());
  };

  const handleSeedData = () => {
    seedDatabase();
    setGames(getSavedGames());
  };

  const handleSaveGame = (game: GameDetails) => {
    saveGame(game);
    setGames(getSavedGames());
    setIsAddingGame(false);
  };

  const cycleTheme = () => {
    const modes: ('light' | 'dark' | 'system')[] = ['system', 'dark', 'light'];
    const nextIndex = (modes.indexOf(theme) + 1) % modes.length;
    setTheme(modes[nextIndex]);
  };

  const toggleColumn = (col: keyof typeof visibleColumns) => {
    setVisibleColumns(prev => ({ ...prev, [col]: !prev[col] }));
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content">
          <h1>🎲 Board Game Stats</h1>
          <button onClick={cycleTheme} className="theme-toggle" title={`Current theme: ${theme}`}>
            {theme === 'system' ? '💻' : theme === 'dark' ? '🌙' : '☀️'}
          </button>
          <button onClick={handleSeedData} className="theme-toggle" title="Load Sample Data">
            📥
          </button>
          <button onClick={() => setIsAddingGame(true)} className="theme-toggle" title="Add Manually">
            ➕
          </button>
          <div className="settings-wrapper">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`theme-toggle ${showSettings ? 'active' : ''}`}
              title="Settings"
            >
              ⚙️
            </button>
            {showSettings && (
              <div className="settings-dropdown">
                <h3>Visible Columns</h3>
                <label>
                  <input
                    type="checkbox"
                    checked={visibleColumns.image}
                    onChange={() => toggleColumn('image')}
                  /> Image
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={visibleColumns.barcode}
                    onChange={() => toggleColumn('barcode')}
                  /> Barcode
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={visibleColumns.owner}
                    onChange={() => toggleColumn('owner')}
                  /> Owner
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={visibleColumns.year}
                    onChange={() => toggleColumn('year')}
                  /> Year
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={visibleColumns.edit}
                    onChange={() => toggleColumn('edit')}
                  /> Edit Action
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={visibleColumns.delete}
                    onChange={() => toggleColumn('delete')}
                  /> Delete Action
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={visibleColumns.communityBestPlayers}
                    onChange={() => toggleColumn('communityBestPlayers')}
                  /> Best Players
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={visibleColumns.communityRecPlayers}
                    onChange={() => toggleColumn('communityRecPlayers')}
                  /> Rec. Players
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={visibleColumns.communityMinAge}
                    onChange={() => toggleColumn('communityMinAge')}
                  /> Comm. Age
                </label>
              </div>
            )}
          </div>
        </div>
        <p className="subtitle">Track, Sort, and Analyze your Collection</p>
      </header>

      <main>
        <section className="search-section">
          <Search onAddGame={handleAddGame} />
        </section>

        <section className="table-section">
          <GameTable
            games={games}
            onRemoveGame={handleRemoveGame}
            onSaveGame={handleSaveGame}
            visibleColumns={visibleColumns}
            isAdding={isAddingGame}
            onCancelAdd={() => setIsAddingGame(false)}
          />
        </section>
      </main>
    </div>
  );
}

export default App;
