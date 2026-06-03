# Connect — Les bases de données

Ce document explique **où sont stockées les données** du projet Connect et **à quoi sert Redis**.

---

## En bref

| Base | Rôle |
|------|------|
| **MongoDB** | Tout le contenu : comptes, posts, messages, stories, fichiers… |
| **Neo4j** | Qui est ami avec qui, les groupes |
| **Redis** | **Cache seulement** — copies temporaires pour aller plus vite |

Les vraies données sont toujours dans **MongoDB** ou **Neo4j**. Si Redis est vide ou redémarré, l’application refonctionne en relisant les bases.

---

## MongoDB

Base : `socialmedia` (voir `MONGODB_URI`).

### `users` — Comptes

- `email`, `password` (hash), `displayName`, `bio`
- `avatarMediaId`, `coverMediaId` → pointent vers un fichier dans `media`
- `address`, `city`, `workplace`, `website`

### `media` — Fichiers (photos, vidéos)

Les fichiers sont dans **GridFS** (gros fichiers possibles, jusqu’à **1 Go**).

- `gridFsFileId` : lien vers le fichier
- `contentType`, `filename`, `size`, `uploadedBy`
- API : `POST /upload` → `mediaId`, puis `GET /media/:id` pour afficher

### `posts` — Publications

- `authorId`, `content`, `groupId` (optionnel)
- `media[]` : `{ type, mediaId, text }`
- `reactions`, `comments` (imbriqués dans le document)

### `conversations` — Messages privés

- `participants` : liste d’utilisateurs
- `messages[]` : `{ senderId, type, content, mediaId, read, createdAt }`
- Les messages non lus sont lus depuis MongoDB (`read: false`)

### `stories` — Stories (24 h)

- `authorId`, `type`, `mediaId`, `text`, `expiresAt`
- Suppression automatique après expiration

### `notifications`

- `userId`, `actorId`, `type`, `message`, `read`
- `postId` ou `conversationId` en option

### `groups` — Infos des groupes

- `neo4jId`, `name`, `description`, `avatarMediaId`, `ownerId`
- Les **membres** sont dans Neo4j, pas ici

---

## Neo4j

Stocke les **liens** entre personnes et groupes.

**Nœuds**

- `User` : `id` (= id MongoDB), `displayName`, `email`
- `Group` : `id`, `name`

**Relations**

- `FRIEND_REQUEST` : demande d’ami en attente
- `FRIENDS` : amis
- `MEMBER_OF` : membre d’un groupe
- `OWNS` : propriétaire du groupe

---

## Redis (cache uniquement)

Redis garde des **copies JSON** avec une **durée de vie courte**. Ce n’est pas la source de vérité.

| Clé (exemple) | Contenu mis en cache | Durée |
|---------------|----------------------|-------|
| `cache:feed:{userId}:{page}` | Fil d’actualité | 2 min |
| `cache:user:{userId}` | Profil public | 5 min |
| `cache:friends:{userId}` | Liste des ids amis | 5 min |
| `cache:stories:{userId}` | Stories des amis | 1 min |
| `cache:convs:{userId}` | Liste des conversations | 30 s |
| `cache:conv:{id}:{userId}` | Une conversation | 1 min |
| `cache:notifs:{userId}` | Liste des notifications | 30 s |
| `cache:media:{mediaId}` | Type / taille du fichier | 1 h |

**Invalidation** : quand on crée ou modifie des données (post, message, profil…), les clés concernées sont supprimées. Au prochain appel, MongoDB est relu et le cache est recréé.

**Ce qui n’est plus dans Redis**

- Sessions / déconnexion → JWT simple côté client
- Compteurs de messages non lus → lus dans MongoDB
- Présence en ligne
- Limite d’uploads par heure

---

## Exemple : publier une photo

1. `POST /upload` → fichier en GridFS, retourne `mediaId`
2. `POST /posts` avec `mediaId` → document dans `posts`
3. Redis supprime les clés `cache:feed:*`
4. Au prochain chargement du fil, MongoDB est interrogé puis le résultat est remis en cache

---

## Variables utiles

| Variable | Défaut |
|----------|--------|
| `MONGODB_URI` | `mongodb://localhost:27017/socialmedia` |
| `NEO4J_URI` | `bolt://localhost:7687` |
| `REDIS_HOST` / `REDIS_PORT` | `localhost` / `6379` |
| `MAX_UPLOAD_SIZE_MB` | `1024` (1 Go) |

---

## Fichiers du code

- Schémas MongoDB : `backend/src/**/schemas/*.schema.ts`
- Médias / GridFS : `backend/src/media/`
- Neo4j : `backend/src/neo4j/`
- Cache Redis : `backend/src/redis/redis-keys.ts`
