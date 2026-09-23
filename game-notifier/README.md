# Game Notifier

Service TypeScript qui remplace progressivement les crons de notifications jeux. Il collecte des évènements normalisés, évite les doublons avec SQLite, publie sur Discord et ntfy, puis permet aux utilisateurs de gérer leurs DM depuis un portail connecté à Discord.

## Fonctionnalités actuelles

- Warframe : alertes, invasions, objectifs Razorback/Fomorian, sorties Eximus Stronghold, offres Darvo et rotations Coda/Tenet.
- Jeux gratuits : GamerPower, avec des abonnements séparés pour Steam, Epic Games Store, itch.io et les autres plateformes PC.
- Promotions : watchlist CheapShark configurable.
- Diffusion : channels Discord, DM Discord et topics ntfy.
- Expiration : les messages Discord associés à un évènement expiré sont grisés et marqués `Expiré`.
- Portail : OAuth2 Discord, abonnements aux DM, évènements récents, historique Darvo/Coda/Tenet et suppression groupée des messages Discord réconciliés avec l'API Discord.
- Logs : masquage batch des évènements récents sans supprimer leur clé d'anti-doublon.
- Debug : topic optionnel produisant périodiquement une notification de contrôle.
- Archives métier : conservation des ventes Darvo et des relevés quotidiens Coda/Tenet dans SQLite, y compris lorsqu'ils ne produisent pas de notification.

L'email n'est pas encore implémenté. Les scripts shell existants restent disponibles comme référence et solution de repli pendant la validation des providers migrés.

## Installation

Prérequis : Node.js 22, npm et les outils de compilation nécessaires à `better-sqlite3`.

```bash
cd /home/benji/workdir/game-notifier
cp .env.example .env
npm install
npm start
```

Le service écoute par défaut sur `127.0.0.1:3000`, afin d'être exposé uniquement par Nginx.

## Configuration Discord

Créer une application dans le Discord Developer Portal, ajouter un bot, puis déclarer l'URL OAuth2 exacte, par exemple `https://notifications.benji.fr/auth/discord/callback`. Le service construit automatiquement cette URL en ajoutant `/auth/discord/callback` à `PUBLIC_URL`.

Variables requises :

- `DISCORD_BOT_TOKEN` : token du bot, jamais versionné ;
- `DISCORD_CLIENT_ID` et `DISCORD_CLIENT_SECRET` : application OAuth2 ;
- `ADMIN_DISCORD_USER_IDS` : IDs Discord séparés par des virgules ;
- `DISCORD_EXPIRED_MESSAGE_ACTION` : `delete` pour supprimer les messages expirés, ou `mark` pour les conserver grisés. Les invasions terminées sont toujours supprimées.

La progression des invasions actives est réconciliée à chaque poll Warframe : le message Discord existant est édité lorsque le pourcentage change, puis supprimé lorsque l'invasion est terminée. Cette mise à jour ne renvoie pas une nouvelle notification.

Les channels et leurs topics sont gérés dans `/admin/channels`, puis stockés dans SQLite comme abonnements. Le nom du channel est résolu à l'ajout et mis en cache. Le bot publie aussi dans le nouveau channel un panneau de boutons permettant aux membres ayant `Manage Channels` d'activer ou désactiver chaque topic sans passer par le portail. Le bot doit pouvoir voir les channels abonnés, envoyer des messages et lire l'historique. Pour les DM, l'utilisateur doit partager un serveur avec le bot et autoriser les messages privés.
Les évènements possédant une URL l'affichent directement sous le message Discord classique.

### Routes du portail

- `/subscriptions` : abonnements Discord personnels ;
- `/history` : historiques Darvo et Coda/Tenet, accessibles à tout utilisateur connecté ;
- `/admin/logs` : déclenchement manuel et logs des évènements ;
- `/admin/messages` : suivi et suppression des messages Discord ;
- `/admin/channels` : abonnements et mode d'envoi des channels.

`/admin` redirige vers `/admin/logs` et l'ancien chemin `/admin/history` redirige vers `/history`.

### Invitation et permissions du bot

Lien d'invitation recommandé, limité aux permissions de base :

<https://discord.com/oauth2/authorize?client_id=784128689302011945&permissions=68608&scope=bot>

| Permission | Valeur | Utilisation |
| --- | ---: | --- |
| `View Channel` | `1024` | Résoudre le nom du channel et accéder aux messages suivis. |
| `Send Messages` | `2048` | Envoyer les notifications classiques et le panneau d'abonnement. |
| `Read Message History` | `65536` | Retrouver, réconcilier, modifier ou supprimer les messages du bot. |

Le bitfield minimal est donc `68608`. Pour respecter le moindre privilège, accorder ensuite `Manage Webhooks` (`536870912`) au rôle du bot uniquement dans les channels où la case « Créer un webhook pour cet ID » est utilisée. Cette permission autorise le bot à rechercher, créer et réutiliser son webhook `Game Notifier`.

Lien tout-en-un incluant `Manage Webhooks` au niveau du serveur :

<https://discord.com/oauth2/authorize?client_id=784128689302011945&permissions=536939520&scope=bot>

Une URL de webhook déjà créée peut être collée dans `/admin/channels` sans donner `Manage Webhooks` au bot : le token inclus dans cette URL autorise directement l'envoi, la modification et la suppression des messages de ce webhook. Cette URL est un secret.

Le bot n'a pas besoin de `Administrator`, `Manage Messages`, `Manage Channels`, `Embed Links`, `Attach Files` ni `Use Application Commands`. `Manage Channels` est vérifiée sur l'utilisateur qui actionne les boutons du panneau, pas sur le bot. Les éventuels refus définis directement sur un channel prennent priorité sur les permissions du rôle.

L'invitation du bot est indépendante de la connexion au portail : le portail demande seulement le scope OAuth2 utilisateur `identify` pour lire l'ID, le nom et l'avatar du compte connecté.

## Configuration des providers

Les providers principaux s'activent avec `WARFRAME_ENABLED`, `FREE_GAMES_ENABLED` et `GAME_DEALS_ENABLED`. Le watcher des armes à bonus de Valence est activé lorsque `LICH_MIN_BONUS` est défini ; son absence le désactive sans générer d'erreur. Les URL communautaires des rotations Coda et Tenet sont des détails d'implémentation conservés dans le provider. `POLL_INTERVAL_SECONDS=30` est le battement du scheduler : il vérifie les créneaux sans appeler les sources en dehors de leurs horaires.

Les rotations utilisent un seuil commun `LICH_MIN_BONUS=58`. Toutes les armes courantes sont archivées et une notification distincte est créée pour chaque Coda ou Tenet qui atteint ce seuil, automatiquement porté à `60 %` par le jeu.

Les horaires utilisent l'heure locale du serveur. Récapitulatif de la migration des crons :

| Topics | Ancien cron | Scheduler actuel |
| --- | --- | --- |
| `warframe.alerts`, `warframe.invasions`, `warframe.goals` | `01,31 * * * *` | toutes les heures à `:01` et `:31` |
| `warframe.darvo` | `1 */26 * * *` | vrai cycle de 26 heures, à `+1` puis `+12` minutes |
| `warframe.coda` | `17 6 * * *` | tous les jours à `06:17` |
| `games.free.steam`, `games.free.epic`, `games.free.itchio`, `games.free.other` | `30 9 * * *` | tous les jours à `09:30` |
| `games.deals` | `50 9 * * *` | tous les jours à `09:50` |
| `warframe.sortie` | `10 18 * * *` | tous les jours à `18:10` |

Darvo utilise `DARVO_REFERENCE_MS` comme début connu d'un cycle, puis calcule les rotations successives de 26 heures. Le passage à `+1 minute` détecte rapidement la nouvelle vente et celui à `+12 minutes` couvre un éventuel retard de l'API. L'anti-doublon empêche le second passage de renvoyer la même notification.

GamerPower lit tous les résultats et traite au maximum 20 nouveaux jeux par passage, avec Steam en premier. Chaque offre est classée dans un seul topic : Steam, Epic Games Store, itch.io, puis Autres pour les plateformes restantes comme Ubisoft Connect ou les distributions DRM-free. Les anciens abonnements `games.free` sont automatiquement migrés vers les quatre topics afin de préserver leur couverture. Les jeux suivants restent éligibles au passage suivant.

Définir `DEBUG_INTERVAL_MINUTES=10` active le provider interne `system.debug`. Si la variable est absente, ce provider est désactivé. Les utilisateurs et channels abonnés à ce topic reçoivent ses notifications.

Le déclenchement manuel interroge le provider du topic. Si aucun évènement courant ne correspond, aucune notification n'est créée. Décocher « Ignorer les évènements déjà vus » permet de renvoyer les évènements courants déjà enregistrés.

La watchlist des promotions est un tableau JSON :

```dotenv
GAME_DEALS_WATCHLIST=[{"title":"Dune: Awakening","minSavings":1,"pageSize":20},{"title":"Borderlands 4","minSavings":1}]
```

La map ntfy utilise les topics déclarés dans `src/core/topics.ts` :

```dotenv
NTFY_TOPIC_MAP={"warframe.invasions":"warframe","games.free.steam":"games","games.free.epic":"games","games.free.itchio":"games","games.free.other":"games"}
```

ntfy est désactivé tant que `NTFY_BASE_URL` n'est pas définie. La présence de cette variable active les envois configurés dans `NTFY_TOPIC_MAP` ; `NTFY_TOKEN` reste optionnel si le serveur autorise les publications anonymes.

## Déploiement

En production :

- définir `NODE_ENV=production` pour imposer le cookie `Secure` ;
- définir `PUBLIC_URL` avec l'origine HTTPS publique exacte ;
- conserver `.env` hors Git avec des permissions restrictives ;
- sauvegarder le fichier SQLite de `DATABASE_PATH` ;
- lancer un seul processus tant que SQLite et la boucle de polling sont dans le même service ;
- terminer TLS dans Nginx et ne pas exposer directement le port 3000.

Le endpoint `GET /health` peut servir au healthcheck. Une unité systemd et le vhost Nginx pourront être ajoutés lorsque le sous-domaine du portail sera choisi.

Les ventes Darvo brutes et un relevé Coda ou Tenet par arme et par jour sont stockés dans la table SQLite `provider_observations` pour constituer leur historique, qu'ils soient intéressants ou non. Pour les autres providers, la table `events` contient uniquement les évènements susceptibles d'être notifiés et sert de clé d'anti-doublon.

La page `/history` affiche ces archives sous forme de tableaux lisibles. Elle est accessible à tout utilisateur connecté avec Discord.

## Migration des crons

Ne désactiver un cron qu'après avoir configuré les destinations correspondantes et observé au moins une rotation complète du provider migré. Vérifier aussi la présence des lignes attendues dans `provider_observations` avant de retirer définitivement les anciens crons.
