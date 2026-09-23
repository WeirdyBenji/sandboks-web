# Améliorations à étudier

## Audits et vérifications

- Auditer la base de données, son schéma, ses migrations, ses index et sa rétention.
- Auditer le code complet.
- Vérifier le fichier `.env`, ses valeurs, ses valeurs par défaut et les services activés par simple présence d'une variable.
- Vérifier qu'aucun provider ne traite de données en dehors de son créneau planifié.
- Vérifier que les messages produits correspondent exactement aux anciens scripts shell.
- Vérifier que le provider Darvo est réellement agnostique des articles surveillés.
- Documenter ce que signifie le statut `Non envoyé` dans les logs.
- Clarifier l'utilité de `ADMIN_DISCORD_USER_IDS` et les capacités réservées aux administrateurs.

## Appels et traitements

- Réduire au minimum le nombre d'appels aux API externes.
- Ne pas poursuivre le traitement d'un évènement qui ne sera envoyé à aucune destination, sauf lorsqu'une archive métier doit être conservée.
- Vérifier qu'un provider hors créneau n'effectue aucun téléchargement, parsing ou autre traitement.
- Étudier une queue en arrière-plan pour les opérations de base de données et surtout Discord, afin que le front n'attende pas leur fin.
- Déterminer quelles opérations ont réellement besoin d'un résultat synchrone dans le front avant d'introduire cette queue.
- Si les opérations deviennent asynchrones, définir comment le front récupère leur résultat et affiche les erreurs.

## Promotions de jeux

- Rendre les promotions de jeux plus génériques.
- Permettre d'ajouter, modifier et supprimer les jeux et les palteformes surveillés depuis le portail.
- Étudier des watchlists propres à chaque utilisateur, en complément ou à la place de la watchlist globa => truck de target 1 personne

## Warframe

- Permettre à chaque utilisateur de choisir les armes qu'il souhaite surveiller et son seui (en nb d'arme)l.=> truck de target 1 personne

## Discord

- Permettre de supprimer le message de gestion des abonnements publié dans un channel.
- Vérifier si l'ajout ou le retrait d'un topic modifie le message existant ou le recrée.
- Ajouter des slash commands lorsque leur rôle par rapport au portail sera défini.
- Fournir un lien d'invitation du bot et documenter précisément les permissions requises.
- Mettre les liens directement dans le corps des messages.
- Réévaluer l'ancien rendu en embed avec expiration et bouton `Ouvrir`.

## Abonnements dans les channels

Évaluer plusieurs approches avant implémentation :

- Envoyer à chaque personne un panneau d'abonnement privé dont les boutons reflètent ses propres abonnements.
- Permettre à un utilisateur abonné de recevoir le message dans le channel, mais de manière privée, sans passer par les DM et sans spammer les autres membres.
- Vérifier si Discord impose alors un message privé par utilisateur ou permet un message unique visible par une sélection d'utilisateurs.
- Permettre à l'utilisateur de choisir si un topic est prioritaire et doit produire une notification visible.
- Éviter de mentionner individuellement tous les utilisateurs abonnés.
- Étudier la création d'un rôle Discord par topic, puis la mention de ce rôle pour les évènements prioritaires.
- Évaluer les permissions supplémentaires, le travail de synchronisation et les risques liés à la gestion automatique des rôles.
- Comparer l'approche par rôles avec les réponses éphémères, les DM et les channels dédiés, notamment sur le nombre de messages générés.

## Portail

- Améliorer nettement le design du front.

---
audit la db
audit le code
ntoif par email
notifs par app
faire un minimum de call api
status non envoyé dans logs c quoi
verif en dehors des crons pas de processing
si pas envoyé alors doit pas traiter sauf si il y a un truk d'historique
plus générique pour les game deals, pouvoir les entrer à la main, voir pouvoir le faire au niveau juste utilisateur pas que global
pouvoir supprimer le msg d'abonnements dans un chan, quand on add/rm un topic ca le recréee ?
async les operations db et surtout discord pour que la queue se fasse en backend et pas attendre et faire charger le front mais ça change surement la logique qui devra écouter le resultat des operations mais check si y'a vmrt besoin de ces résultas
navbar mal organisée et routes
verif darvo bien agnostic
modif le truck coda pour faire historique de tous les coda + tenet et notif tous les 60%, voir permettre a chaque user de choisir quelle arme il veut
varif si les msg correspondent exactement aux scripts sh
slash commands
sert à quoi d'etre admin dans l'env ?
lien pour inviter le bot et perms dont il a besoin
liens direct dans le corps du texte
acnien design embed avec expiration et btn ouvrir
check le .env
antidoublon global ou basé sur les logs ? mais donc c'est save dans la même ligne db ? et donc doit pas supprime rles logs
front moins moche
pk y'a le msg de liste d'abonnement qui est re posté a 19h12 alors que je l'avais supprimé ?
le msg pour choisir à quel topic s'abo derai etre (privé) à chaque personne pour que les btns s'adapent à la personne, et quand un user a coché il recevrai dans le canal que pour lui pour pas spam les autres et pas en dm mais alors ca ferai 1 msg par user ? ou 1 msg et peut select les users privé ?, et pouvoir choisir si prioritaire pour le tagger et qu'il ai une notif (comme ce que j'ai dans les scripts mais pour usage privé psk on veut pas mettre le pseudo de tout le monde, ou alors il faudrait créer un tag par topic et mentioner le tag u montrer qu'au tag, utile pour les channels mais demand eplus de permissions et travail et reduis maybe le nombre de messages c'est surement une autre approche à evaluer)"

dire que les jeux en promo et free c'est que PC
prioritéchoix detre tag ou pas pour avoir lanotif donc truck de target 1 personne
repo commits yolo ou [https://github.com/shlomif/fortune-mod](https://github.com/shlomif/fortune-mod)

update le stock Darvo, avec lo call de h+12
update les corrections communautaires Coda/Tenet
lien entre log et msg, si supprime un log alors ca va retrigger un event dejà vu ?