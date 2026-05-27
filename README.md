# Connect — Réseau Social NoSQL

Projet de cours NoSQL : réseau social complet avec **MongoDB**, **Neo4j** et **Redis**.

> **Documentation détaillée** : voir [ARCHITECTURE.md](./ARCHITECTURE.md) — architecture complète, justification du choix des 3 bases (polyglot persistence), matrice de décision vs alternatives, et mapping fonctionnalités ↔ technologies.

## Fonctionnalités

- Inscription / connexion (JWT + sessions Redis + blacklist logout)
- Profils utilisateur (avatar, couverture, bio, ville, lieu de travail, site web)
- Amis (graphe Neo4j : demandes, acceptation, suggestions « people you may know »)
- Fil d'actualité avec publications texte, images, vidéos
- Réactions sur les publications + modal détail des réactions
- Commentaires avec réactions et réponses imbriquées
- Stories (expiration 24h, TTL MongoDB)
- Messages privés en temps réel (WebSocket + MongoDB + compteurs non lus Redis)
- Notifications in-app (MongoDB + push WebSocket)
- Groupes (membres Neo4j, publications MongoDB)

## Architecture des bases de données

| Base | Rôle |
|------|------|
| **MongoDB** | Documents : utilisateurs, posts, commentaires, conversations, stories, métadonnées groupes |
| **Neo4j** | Graphe : nœuds User/Group, relations FRIENDS, FRIEND_REQUEST, MEMBER_OF, OWNS |
| **Redis** | Cache du fil d'actualité, sessions, blacklist JWT, compteurs messages non lus |

## Stack technique

- **Frontend** : Angular 18 (interface sombre moderne)
- **Backend** : NestJS (Node.js / TypeScript)
- **Orchestration** : Docker Compose

## Démarrage rapide

### Prérequis

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installé et démarré

### Lancer l'application

```bash
cd "Social Media"
docker compose up --build
```

Premier démarrage : 3 à 5 minutes (téléchargement des images + build).

### Accès

| Service | URL |
|---------|-----|
| **Application** | http://localhost:4200 |
| **API** | http://localhost:3000 |
| **Neo4j Browser** | http://localhost:7474 (neo4j / password123) |
| **MongoDB** | localhost:27017 |
| **Redis** | localhost:6379 |

### Utilisation

1. Ouvrir http://localhost:4200
2. Créer un compte (ou plusieurs pour tester les interactions)
3. Rechercher des utilisateurs → envoyer des demandes d'amis
4. Publier sur le fil, créer des stories, rejoindre des groupes, envoyer des messages

## Structure du projet

```
├── docker-compose.yml
├── backend/          # API NestJS
│   └── src/
│       ├── auth/     # JWT + Redis sessions
│       ├── users/    # Profils (MongoDB + nœud Neo4j)
│       ├── friends/  # Graphe social (Neo4j)
│       ├── posts/    # Publications (MongoDB + cache Redis)
│       ├── messages/ # MP (MongoDB + WebSocket)
│       ├── stories/  # Stories 24h (MongoDB TTL)
│       ├── groups/   # Groupes (Neo4j + MongoDB)
│       ├── neo4j/
│       └── redis/
└── frontend/         # Application Angular
```

## Développement local (sans Docker)

### Bases de données

```bash
docker compose up mongodb neo4j redis -d
```

### Backend

```bash
cd backend
npm install
# Créer .env avec MONGODB_URI, NEO4J_URI, REDIS_HOST, JWT_SECRET
npm run start:dev
```

### Frontend

```bash
cd frontend
npm install
npm start
```

## Arrêt

```bash
docker compose down
```

Pour supprimer les données :

```bash
docker compose down -v
```

## Auteurs

Projet académique — cours NoSQL.
