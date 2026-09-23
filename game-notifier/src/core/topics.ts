export interface TopicDefinition {
  id: string;
  label: string;
  description: string;
  linkLabel?: string;
  discordIdentity: {
    username: string;
    avatarUrl?: string;
  };
}

const warframeDiscordIdentity = {
  username: "Waluflamu",
  avatarUrl: "https://images.discordapp.net/avatars/593364281572196353/a546d94969b5bca36003c843ee86bd9f.png"
};

const freeGamesDiscordIdentity = {
  username: "Jeux gratuits",
  avatarUrl: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f3ae.png"
};

export const topics: readonly TopicDefinition[] = [
  { id: "system.debug", label: "Notifications debug", description: "Vérification périodique du moteur de notifications.", discordIdentity: { username: "Game Notifier" } },
  { id: "warframe.alerts", label: "Alertes Warframe", description: "Missions d'alerte actives.", discordIdentity: warframeDiscordIdentity },
  { id: "warframe.invasions", label: "Invasions Warframe", description: "Récompenses intéressantes des invasions.", discordIdentity: warframeDiscordIdentity },
  { id: "warframe.goals", label: "Objectifs Warframe", description: "Évènements globaux et Razorback/Fomorian.", discordIdentity: warframeDiscordIdentity },
  { id: "warframe.sortie", label: "Sorties Warframe", description: "Sorties avec Eximus Stronghold.", discordIdentity: warframeDiscordIdentity },
  { id: "warframe.darvo", label: "Darvo", description: "Offres Darvo intéressantes (Forma, Aura Forma, Stance Forma, Umbra Forma, Orokin Catalyst, Orokin Reactor, Exilus Warframe Adapter, Exilus Weapon Adapter).", discordIdentity: warframeDiscordIdentity },
  { id: "warframe.coda", label: "Armes Coda et Tenet", description: "Rotations Coda et Tenet dépassant le seuil configuré.", linkLabel: "Voir la rotation", discordIdentity: warframeDiscordIdentity },
  { id: "games.free.steam", label: "Jeux gratuits Steam", description: "Jeux temporairement gratuits sur Steam.", discordIdentity: freeGamesDiscordIdentity },
  { id: "games.free.epic", label: "Jeux gratuits Epic", description: "Jeux temporairement gratuits sur l'Epic Games Store.", discordIdentity: freeGamesDiscordIdentity },
  { id: "games.free.itchio", label: "Jeux gratuits itch.io", description: "Jeux temporairement gratuits sur itch.io.", discordIdentity: freeGamesDiscordIdentity },
  { id: "games.free.other", label: "Autres jeux gratuits", description: "Jeux gratuits sur les autres plateformes PC.", discordIdentity: freeGamesDiscordIdentity },
  { id: "games.deals", label: "Promotions jeux", description: "Promotions de la watchlist.", discordIdentity: { username: "Dune Watcher", avatarUrl: "https://cdn.cloudflare.steamstatic.com/steam/apps/1172710/header.jpg" } }
] as const;

export const topicIds = new Set(topics.map((topic) => topic.id));
