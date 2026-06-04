# Connect — Architecture

## Ce qu'est le projet

Connect est un réseau social avec un fil d'actualité, des amis, des messages privés, des stories, des groupes et des notifications.

Le backend est en **NestJS** (Node.js / TypeScript), le frontend en **Angular 18**, et tout tourne avec **Docker Compose**.

---

## Les trois bases de données

| Base | Ce qu'elle stocke |
|------|-------------------|
| **MongoDB** | Le contenu : comptes, publications, commentaires, messages, stories, notifications |
| **Neo4j** | Les liens : qui est ami avec qui, qui est membre de quel groupe |
| **Redis** | Le cache : copies temporaires pour aller plus vite |

Chaque base fait ce qu'elle fait le mieux. MongoDB garde le contenu, Neo4j garde les relations, Redis accélère les lectures fréquentes.

---

## Comment les données circulent

### Charger le fil d'actualité

1. L'API récupère la liste des amis depuis **Neo4j**
2. Elle vérifie si le fil est déjà dans **Redis**
3. Si oui, elle le retourne directement
4. Sinon, elle interroge **MongoDB**, puis met le résultat en cache dans Redis

### Envoyer une demande d'ami

1. L'API vérifie que l'utilisateur existe dans **MongoDB**
2. Elle crée une relation `FRIEND_REQUEST` dans **Neo4j**
3. Elle supprime les caches Redis concernés

### Envoyer un message

1. Le message est ajouté dans **MongoDB**
2. Le compteur de messages non lus est mis à jour dans **Redis**
3. Un événement WebSocket est envoyé au destinataire

---

## Suggestions d'amis

La fonctionnalité "Personnes que vous connaissez peut-être" repose entièrement sur **Neo4j**.

Deux signaux sont utilisés :

1. Les amis d'amis : les personnes connectées à vos amis mais pas encore à vous
2. Les groupes communs : les personnes qui sont membres des mêmes groupes que vous

Les résultats sont triés par nombre d'amis en commun, puis par nombre de groupes partagés.

---

## Modules du backend

| Module | Rôle |
|--------|------|
| `auth` | Connexion et vérification JWT |
| `users` | Gestion des profils utilisateur |
| `friends` | Graphe social dans Neo4j |
| `posts` | Publications et commentaires |
| `messages` | Conversations privées |
| `stories` | Stories avec expiration automatique |
| `groups` | Groupes et membres |
| `notifications` | Alertes et événements |
| `neo4j` | Connexion au driver Neo4j |
| `redis` | Connexion et helpers Redis |
| `chat` | Passerelle WebSocket |

---

## Résumé

**MongoDB** stocke ce que les utilisateurs écrivent.  
**Neo4j** stocke qui connaît qui.  
**Redis** rend les lectures rapides.
