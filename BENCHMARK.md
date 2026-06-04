# Connect — Pourquoi ces bases de données ?

---

## Volume de données et de requêtes estimé

Ce tableau donne une idée du volume pour une application de taille moyenne (environ 50 000 utilisateurs actifs par mois).

| Type de donnée ou de requête | Volume estimé |
|------------------------------|---------------|
| Utilisateurs enregistrés | 100 000 comptes |
| Publications créées par jour | 20 000 posts |
| Commentaires par jour | 80 000 commentaires |
| Messages privés par jour | 200 000 messages |
| Stories actives à tout moment | 15 000 stories |
| Chargements du fil d'actualité par heure | 50 000 requêtes |
| Vérifications de session par heure | 200 000 requêtes |
| Requêtes de suggestions d'amis par heure | 5 000 requêtes |
| Taille moyenne d'un post avec commentaires | 5 Ko |
| Taille totale des médias (photos, vidéos) | plusieurs To |

Les lectures sont très largement majoritaires par rapport aux écritures (environ 90 % de lectures).

---

## Comparaison des bases de données

Pour chaque besoin du projet, voici comment se comparent les options envisagées.

### Stocker le contenu (posts, messages, profils)

| Base | Adapté ? | Raison |
|------|----------|--------|
| **MongoDB** | Oui | Un post avec ses commentaires est un seul document, facile à lire et à écrire |
| PostgreSQL | Moyen | Nécessite plusieurs tables et des jointures pour reconstruire un post avec ses commentaires |
| Neo4j | Non | Pensé pour les relations, pas pour stocker de gros blocs de contenu |
| Redis | Non | Pas fait pour être une source de données durable |

### Gérer les amis et les groupes

| Base | Adapté ? | Raison |
|------|----------|--------|
| **Neo4j** | Oui | Les amis d'amis, les suggestions, les membres d'un groupe sont des requêtes naturelles en graphe |
| PostgreSQL | Moyen | Possible avec des jointures récursives, mais la requête devient vite complexe |
| MongoDB | Non | Il faut simuler le graphe en application, ce qui est lent et difficile à maintenir |
| Redis | Non | Pas adapté à ce type de requête |

### Accélérer les lectures fréquentes

| Base | Adapté ? | Raison |
|------|----------|--------|
| **Redis** | Oui | Lecture en mémoire en moins d'une milliseconde, TTL natif, parfait pour du cache |
| MongoDB | Moyen | Peut être rapide avec de bons index, mais pas conçu pour du cache applicatif |
| PostgreSQL | Moyen | Même remarque que MongoDB |
| Neo4j | Non | Conçu pour les traversées de graphe, pas pour du cache clé/valeur |

---

## Conclusion

Chaque base a été choisie parce qu'elle correspond naturellement au type de données qu'elle stocke.

Une seule base aurait forcé des compromis : MongoDB seul rendrait les suggestions d'amis très complexes, Neo4j seul serait mal adapté pour stocker des milliers de messages, et PostgreSQL seul nécessiterait beaucoup de travail pour imiter ce que Neo4j fait simplement.

L'approche choisie (polyglot persistence) consiste à utiliser la bonne base pour chaque problème.
