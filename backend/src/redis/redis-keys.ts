/** Clés Redis — cache uniquement (données recalculables depuis MongoDB / Neo4j). */
export const RedisKeys = {
  feed: (userId: string, page: number) => `cache:feed:${userId}:${page}`,
  feedPattern: (userId?: string) => (userId ? `cache:feed:${userId}*` : 'cache:feed:*'),

  userProfile: (userId: string) => `cache:user:${userId}`,
  friendIds: (userId: string) => `cache:friends:${userId}`,

  storiesFeed: (userId: string) => `cache:stories:${userId}`,
  conversationsList: (userId: string) => `cache:convs:${userId}`,
  conversation: (conversationId: string, userId: string) => `cache:conv:${conversationId}:${userId}`,

  notifList: (userId: string) => `cache:notifs:${userId}`,
  mediaMeta: (mediaId: string) => `cache:media:${mediaId}`,
} as const;

/** Durée de vie du cache en secondes. */
export const RedisTTL = {
  feed: 120,
  userProfile: 300,
  friendIds: 300,
  storiesFeed: 60,
  conversationsList: 30,
  conversation: 60,
  notifList: 30,
  mediaMeta: 3600,
} as const;
