import { useState, useEffect } from 'react';
import type { GameDetails } from '../services/bgg';

interface GameTableProps {
    games: GameDetails[];
    onRemoveGame: (id: string) => void;
    onSaveGame: (game: GameDetails) => void;
    visibleColumns: {
        image: boolean;
        year: boolean;
        delete: boolean;
        barcode: boolean;
        owner: boolean;
        communityBestPlayers: boolean;
        communityRecPlayers: boolean;
        communityMinAge: boolean;
        edit: boolean;
    };
    isAdding: boolean;
    onCancelAdd: () => void;
}

type SortField = 'rank' | 'averageRating' | 'weight' | 'minPlaytime' | 'minAge' | 'minPlayers';
type SortDirection = 'asc' | 'desc';

export const GameTable = ({ games, onRemoveGame, onSaveGame, visibleColumns, isAdding, onCancelAdd }: GameTableProps) => {
    const [sortField, setSortField] = useState<SortField>('rank');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<GameDetails>>({});

    // Initialize form for adding new game
    useEffect(() => {
        if (isAdding) {
            setEditingId('NEW_GAME');
            setEditForm({
                name: '',
                yearPublished: '',
                rank: 0,
                averageRating: 0,
                weight: 0,
                minPlaytime: 0,
                maxPlaytime: 0,
                minAge: 0,
                minPlayers: 0,
                maxPlayers: 0,
                barcode: '',
                owner: '',
                thumbnail: '',
                image: '',
                description: '',
                communityBestPlayers: '',
                communityRecPlayers: '',
                communityMinAge: 0,
            });
        }
    }, [isAdding]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const sortedGames = [...games].sort((a, b) => {
        const aValue = a[sortField];
        const bValue = b[sortField];

        // Handle 0 or undefined as last for rank (unranked)
        if (sortField === 'rank') {
            if (!aValue) return 1;
            if (!bValue) return -1;
        }

        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    const renderSortIcon = (field: SortField) => {
        if (sortField !== field) return <span className="sort-icon">↕</span>;
        return sortDirection === 'asc' ? <span className="sort-icon">↑</span> : <span className="sort-icon">↓</span>;
    };

    const handleEditClick = (game: GameDetails) => {
        setEditingId(game.id);
        setEditForm({ ...game });
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditForm({});
        if (isAdding) onCancelAdd();
    };

    const handleSave = () => {
        if (!editForm.name) return; // Basic validation

        const gameToSave: GameDetails = {
            id: editingId === 'NEW_GAME' ? `manual-${Date.now()}` : editingId!,
            name: editForm.name || 'Unknown',
            yearPublished: editForm.yearPublished,
            rank: Number(editForm.rank) || 0,
            averageRating: Number(editForm.averageRating) || 0,
            weight: Number(editForm.weight) || 0,
            minPlaytime: Number(editForm.minPlaytime) || 0,
            maxPlaytime: Number(editForm.maxPlaytime) || 0,
            minAge: Number(editForm.minAge) || 0,
            minPlayers: Number(editForm.minPlayers) || 0,
            maxPlayers: Number(editForm.maxPlayers) || 0,
            barcode: editForm.barcode,
            owner: editForm.owner,
            thumbnail: editForm.thumbnail || '',
            image: editForm.image || '',
            description: editForm.description || '',
            communityBestPlayers: editForm.communityBestPlayers,
            communityRecPlayers: editForm.communityRecPlayers,
            communityMinAge: Number(editForm.communityMinAge) || 0,
        };

        onSaveGame(gameToSave);
        setEditingId(null);
        setEditForm({});
        if (isAdding) onCancelAdd();
    };

    const handleChange = (field: keyof GameDetails, value: string | number) => {
        setEditForm(prev => ({ ...prev, [field]: value }));
    };

    const displayValue = (val: number | undefined) => {
        return val && val !== 0 ? val : '';
    };

    const displayRange = (min: number | undefined, max: number | undefined, suffix: string = '') => {
        if (!min && !max) return '';
        if (min === 0 && max === 0) return '';
        if (min === max) return `${min}${suffix}`;
        return `${min}-${max}${suffix}`;
    };

    const renderRow = (game: GameDetails | null, isNew: boolean = false) => {
        const isEditing = isNew || (game && editingId === game.id);
        const data = isEditing ? editForm : game!;
        const key = isNew ? 'new-row' : game!.id;

        if (isEditing) {
            return (
                <tr key={key} className="editing-row">
                    {visibleColumns.image && (
                        <td>
                            <input
                                type="text"
                                placeholder="Img URL"
                                value={data.thumbnail || ''}
                                onChange={(e) => handleChange('thumbnail', e.target.value)}
                                className="edit-input"
                            />
                        </td>
                    )}
                    {visibleColumns.barcode && (
                        <td>
                            <input
                                type="text"
                                placeholder="Barcode"
                                value={data.barcode || ''}
                                onChange={(e) => handleChange('barcode', e.target.value)}
                                className="edit-input"
                            />
                        </td>
                    )}
                    <td className="game-name-cell">
                        <input
                            type="text"
                            placeholder="Name"
                            value={data.name || ''}
                            onChange={(e) => handleChange('name', e.target.value)}
                            className="edit-input name-input"
                            autoFocus
                        />
                        {visibleColumns.year && (
                            <input
                                type="text"
                                placeholder="Year"
                                value={data.yearPublished || ''}
                                onChange={(e) => handleChange('yearPublished', e.target.value)}
                                className="edit-input year-input"
                            />
                        )}
                    </td>
                    {visibleColumns.owner && (
                        <td>
                            <input
                                type="text"
                                placeholder="Owner"
                                value={data.owner || ''}
                                onChange={(e) => handleChange('owner', e.target.value)}
                                className="edit-input"
                            />
                        </td>
                    )}
                    <td><input type="number" value={data.rank || 0} onChange={(e) => handleChange('rank', e.target.value)} className="edit-input num-input" /></td>
                    <td><input type="number" step="0.1" value={data.averageRating || 0} onChange={(e) => handleChange('averageRating', e.target.value)} className="edit-input num-input" /></td>
                    <td><input type="number" step="0.01" value={data.weight || 0} onChange={(e) => handleChange('weight', e.target.value)} className="edit-input num-input" /></td>
                    <td>
                        <div className="range-inputs">
                            <input type="number" value={data.minPlaytime || 0} onChange={(e) => handleChange('minPlaytime', e.target.value)} className="edit-input num-input" />
                            -
                            <input type="number" value={data.maxPlaytime || 0} onChange={(e) => handleChange('maxPlaytime', e.target.value)} className="edit-input num-input" />
                        </div>
                    </td>
                    <td><input type="number" value={data.minAge || 0} onChange={(e) => handleChange('minAge', e.target.value)} className="edit-input num-input" /></td>
                    <td>
                        <div className="range-inputs">
                            <input type="number" value={data.minPlayers || 0} onChange={(e) => handleChange('minPlayers', e.target.value)} className="edit-input num-input" />
                            -
                            <input type="number" value={data.maxPlayers || 0} onChange={(e) => handleChange('maxPlayers', e.target.value)} className="edit-input num-input" />
                        </div>
                    </td>
                    {visibleColumns.communityBestPlayers && (
                        <td>
                            <input
                                type="text"
                                placeholder="Best"
                                value={data.communityBestPlayers || ''}
                                onChange={(e) => handleChange('communityBestPlayers', e.target.value)}
                                className="edit-input"
                            />
                        </td>
                    )}
                    {visibleColumns.communityRecPlayers && (
                        <td>
                            <input
                                type="text"
                                placeholder="Rec"
                                value={data.communityRecPlayers || ''}
                                onChange={(e) => handleChange('communityRecPlayers', e.target.value)}
                                className="edit-input"
                            />
                        </td>
                    )}
                    {visibleColumns.communityMinAge && (
                        <td>
                            <input
                                type="number"
                                placeholder="Age"
                                value={data.communityMinAge || 0}
                                onChange={(e) => handleChange('communityMinAge', e.target.value)}
                                className="edit-input num-input"
                            />
                        </td>
                    )}
                    <td className="actions-cell">
                        <button className="action-btn save-btn-icon" onClick={handleSave} title="Save">💾</button>
                        <button className="action-btn cancel-btn-icon" onClick={handleCancelEdit} title="Cancel">❌</button>
                    </td>
                </tr>
            );
        }

        return (
            <tr key={game!.id}>
                {visibleColumns.image && (
                    <td>
                        <img src={game!.thumbnail} alt={game!.name} className="game-thumb" />
                    </td>
                )}
                {visibleColumns.barcode && (
                    <td className="barcode-cell">{game!.barcode || '-'}</td>
                )}
                <td className="game-name-cell">
                    <div className="name">{game!.name}</div>
                    {visibleColumns.year && <div className="year">{game!.yearPublished}</div>}
                </td>
                {visibleColumns.owner && (
                    <td>{game!.owner || '-'}</td>
                )}
                <td>{displayValue(game!.rank) || '-'}</td>
                <td>{game!.averageRating ? game!.averageRating.toFixed(1) : ''}</td>
                <td>{game!.weight ? game!.weight.toFixed(2) : ''}</td>
                <td>{displayRange(game!.minPlaytime, game!.maxPlaytime, 'm')}</td>
                <td>{game!.minAge ? `${game!.minAge}+` : ''}</td>
                <td>{displayRange(game!.minPlayers, game!.maxPlayers)}</td>
                {visibleColumns.communityBestPlayers && <td>{game!.communityBestPlayers || '-'}</td>}
                {visibleColumns.communityRecPlayers && <td>{game!.communityRecPlayers || '-'}</td>}
                {visibleColumns.communityMinAge && <td>{game!.communityMinAge ? `${game!.communityMinAge}+` : '-'}</td>}
                <td className="actions-cell">
                    {visibleColumns.edit && (
                        <button
                            className="action-btn edit-btn"
                            onClick={() => handleEditClick(game!)}
                            title="Edit Game"
                        >
                            ✏️
                        </button>
                    )}
                    <a
                        href={`https://boardgamegeek.com/boardgame/${game!.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="action-btn bgg-link"
                        title="View on BGG"
                    >
                        🔗
                    </a>
                    {visibleColumns.delete && (
                        <button className="action-btn delete-btn" onClick={() => onRemoveGame(game!.id)}>×</button>
                    )}
                </td>
            </tr>
        );
    };

    return (
        <div className="table-container">
            <table className="game-table">
                <thead>
                    <tr>
                        {visibleColumns.image && <th>Image</th>}
                        {visibleColumns.barcode && <th>Barcode</th>}
                        <th>Name</th>
                        {visibleColumns.owner && <th>Owner</th>}
                        <th onClick={() => handleSort('rank')}>Rank {renderSortIcon('rank')}</th>
                        <th onClick={() => handleSort('averageRating')}>Rating {renderSortIcon('averageRating')}</th>
                        <th onClick={() => handleSort('weight')}>Weight {renderSortIcon('weight')}</th>
                        <th onClick={() => handleSort('minPlaytime')}>Time {renderSortIcon('minPlaytime')}</th>
                        <th onClick={() => handleSort('minAge')}>Age {renderSortIcon('minAge')}</th>
                        <th onClick={() => handleSort('minPlayers')}>Players {renderSortIcon('minPlayers')}</th>
                        {visibleColumns.communityBestPlayers && <th>Best Players</th>}
                        {visibleColumns.communityRecPlayers && <th>Rec. Players</th>}
                        {visibleColumns.communityMinAge && <th>Comm. Age</th>}
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {isAdding && renderRow(null, true)}
                    {sortedGames.map((game) => renderRow(game))}
                    {!isAdding && sortedGames.length === 0 && (
                        <tr>
                            <td colSpan={14} className="empty-state">
                                No games added yet. Search above to add some!
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};
