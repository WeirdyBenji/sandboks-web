import type { GameDetails } from './bgg';

const STORAGE_KEY = 'bgstats_collection';

export const getSavedGames = (): GameDetails[] => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
};

export const saveGame = (game: GameDetails): void => {
    const games = getSavedGames();
    const existingIndex = games.findIndex(g => g.id === game.id);

    if (existingIndex >= 0) {
        games[existingIndex] = game;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
    } else {
        const newGames = [...games, game];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newGames));
    }
};

export const removeGame = (id: string): void => {
    const games = getSavedGames();
    const newGames = games.filter(g => g.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newGames));
};

export const seedDatabase = (): void => {
    const sampleGames: GameDetails[] = [
        {
            id: '13',
            name: 'Catan',
            yearPublished: '1995',
            thumbnail: 'https://cf.geekdo-images.com/W3Bsga_uLP9kO91gZ7H8yw__thumb/img/8a9HeqF82eOgULocikFSTh64258=/fit-in/200x150/filters:strip_icc()/pic2419375.jpg',
            image: 'https://cf.geekdo-images.com/W3Bsga_uLP9kO91gZ7H8yw__original/img/4F3w1pRCiB5a_l6q8d7t8p675jI=/0x0/filters:format(jpeg)/pic2419375.jpg',
            description: 'In Catan (formerly The Settlers of Catan), players try to be the dominant force on the island of Catan by building settlements, cities, and roads.',
            rank: 425,
            averageRating: 7.14,
            weight: 2.31,
            minPlaytime: 60,
            maxPlaytime: 120,
            minAge: 10,
            minPlayers: 3,
            maxPlayers: 4
        },
        {
            id: '30549',
            name: 'Pandemic',
            yearPublished: '2008',
            thumbnail: 'https://cf.geekdo-images.com/S3ybV1LAp-8SnHIXLLjVqA__thumb/img/oqViRj6n5qg9e5tZ5t8i5p5j8z8=/fit-in/200x150/filters:strip_icc()/pic1534148.jpg',
            image: 'https://cf.geekdo-images.com/S3ybV1LAp-8SnHIXLLjVqA__original/img/Is9e7e7e7e7e7e7e7e7e7e7e7e7=/0x0/filters:format(jpeg)/pic1534148.jpg',
            description: 'In Pandemic, several virulent diseases have broken out simultaneously all over the world! The players are disease-fighting specialists whose mission is to treat disease hotspots while researching cures for each of four plagues before they get out of hand.',
            rank: 126,
            averageRating: 7.59,
            weight: 2.41,
            minPlaytime: 45,
            maxPlaytime: 45,
            minAge: 8,
            minPlayers: 2,
            maxPlayers: 4
        },
        {
            id: '266192',
            name: 'Wingspan',
            yearPublished: '2019',
            thumbnail: 'https://cf.geekdo-images.com/yLZJCVLlIx4c7eJEWUNJ7w__thumb/img/VNToqgS2-p_k-9j-9j-9j-9j-9j=/fit-in/200x150/filters:strip_icc()/pic4458123.jpg',
            image: 'https://cf.geekdo-images.com/yLZJCVLlIx4c7eJEWUNJ7w__original/img/3s8s8s8s8s8s8s8s8s8s8s8s8s8=/0x0/filters:format(jpeg)/pic4458123.jpg',
            description: 'Wingspan is a competitive, medium-weight, card-driven, engine-building board game from Stonemaier Games.',
            rank: 25,
            averageRating: 8.11,
            weight: 2.45,
            minPlaytime: 40,
            maxPlaytime: 70,
            minAge: 10,
            minPlayers: 1,
            maxPlayers: 5
        },
        {
            id: '167791',
            name: 'Terraforming Mars',
            yearPublished: '2016',
            thumbnail: 'https://cf.geekdo-images.com/wg9oOLcsKvDesSUdZQ4rxw__thumb/img/6z9z9z9z9z9z9z9z9z9z9z9z9z9=/fit-in/200x150/filters:strip_icc()/pic3536616.jpg',
            image: 'https://cf.geekdo-images.com/wg9oOLcsKvDesSUdZQ4rxw__original/img/7x8x8x8x8x8x8x8x8x8x8x8x8x8=/0x0/filters:format(jpeg)/pic3536616.jpg',
            description: 'In the 2400s, mankind begins to terraform the planet Mars. Giant corporations, sponsored by the World Government on Earth, initiate huge projects to raise the temperature, the oxygen level, and the ocean coverage until the environment is habitable.',
            rank: 6,
            averageRating: 8.38,
            weight: 3.25,
            minPlaytime: 120,
            maxPlaytime: 120,
            minAge: 12,
            minPlayers: 1,
            maxPlayers: 5
        },
        {
            id: '9209',
            name: 'Ticket to Ride',
            yearPublished: '2004',
            thumbnail: 'https://cf.geekdo-images.com/ZWJg0dCdrWHxVnc0eFqHqA__thumb/img/9j9j9j9j9j9j9j9j9j9j9j9j9j9=/fit-in/200x150/filters:strip_icc()/pic38668.jpg',
            image: 'https://cf.geekdo-images.com/ZWJg0dCdrWHxVnc0eFqHqA__original/img/0k0k0k0k0k0k0k0k0k0k0k0k0k0=/0x0/filters:format(jpeg)/pic38668.jpg',
            description: 'Ticket to Ride is a cross-country train adventure in which players collect and play matching train cards to claim railway routes connecting cities through North America.',
            rank: 205,
            averageRating: 7.41,
            weight: 1.84,
            minPlaytime: 30,
            maxPlaytime: 60,
            minAge: 8,
            minPlayers: 2,
            maxPlayers: 5
        }
    ];

    localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleGames));
};
