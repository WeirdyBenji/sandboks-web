

## Matrice de Priorisation par Comparaison par Paires

Une application web permettant de classer des projets en les comparant deux à deux, avec sauvegarde automatique en local storage.

### Fonctionnalités

**1. Gestion des projets**
- Ajouter, modifier et supprimer des projets à comparer
- Nom et description optionnelle pour chaque projet
- Minimum 2 projets requis pour lancer la comparaison

**2. Comparaison par paires**
- Présentation de chaque paire de projets l'une après l'autre (mode "duel")
- Pour chaque paire, l'utilisateur choisit quel projet est prioritaire
- Indicateur de progression (ex: "Comparaison 3/10")
- Possibilité de revenir en arrière et modifier un choix

**3. Vue Matrice**
- Affichage de la matrice complète des comparaisons sous forme de tableau
- Les projets en lignes et colonnes, avec le résultat de chaque confrontation
- Possibilité de modifier un choix directement depuis la matrice

**4. Classement Final**
- Classement des projets du plus prioritaire au moins prioritaire
- Score affiché (nombre de "victoires" pour chaque projet)
- Visualisation claire avec podium ou barres de progression

**5. Sauvegarde locale**
- Sauvegarde automatique dans le local storage du navigateur
- Les projets et toutes les comparaisons sont persistés
- Possibilité de réinitialiser et recommencer une nouvelle session

### Design
- Interface épurée et moderne
- Étapes guidées : 1) Ajouter les projets → 2) Comparer → 3) Voir le classement
- Responsive pour mobile et desktop

