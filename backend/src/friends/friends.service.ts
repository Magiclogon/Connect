import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Neo4jService } from '../neo4j/neo4j.service';
import { RedisService } from '../redis/redis.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class FriendsService {
  constructor(
    private neo4j: Neo4jService,
    private redis: RedisService,
    private usersService: UsersService,
  ) {}

  async sendRequest(fromId: string, toId: string) {
    if (!toId || typeof toId !== 'string') {
      throw new BadRequestException('Utilisateur cible invalide');
    }
    if (fromId === toId) throw new BadRequestException('Action impossible');
    const target = await this.usersService.findById(toId).catch(() => null);
    if (!target) {
      throw new NotFoundException('Utilisateur cible introuvable');
    }
    await this.neo4j.run(
      `MATCH (a:User {id: $fromId}), (b:User {id: $toId})
       MERGE (a)-[r:FRIEND_REQUEST]->(b)
       ON CREATE SET r.createdAt = datetime(), r.status = 'pending'`,
      { fromId, toId },
    );
    await this.redis.invalidatePattern(`feed:${fromId}*`);
    await this.redis.invalidatePattern(`feed:${toId}*`);
    return { message: 'Demande envoyée' };
  }

  async acceptRequest(userId: string, fromId: string) {
    await this.neo4j.run(
      `MATCH (a:User {id: $fromId})-[r:FRIEND_REQUEST]->(b:User {id: $userId})
       DELETE r
       MERGE (a)-[:FRIENDS {since: datetime()}]-(b)`,
      { fromId, userId },
    );
    await this.redis.invalidatePattern(`feed:${userId}*`);
    await this.redis.invalidatePattern(`feed:${fromId}*`);
    return { message: 'Demande acceptée' };
  }

  async rejectRequest(userId: string, fromId: string) {
    await this.neo4j.run(
      `MATCH (a:User {id: $fromId})-[r:FRIEND_REQUEST]->(b:User {id: $userId}) DELETE r`,
      { fromId, userId },
    );
    return { message: 'Demande refusée' };
  }

  async getFriends(userId: string) {
    const records = await this.neo4j.run<{ friendId: string }>(
      `MATCH (u:User {id: $userId})-[:FRIENDS]-(f:User)
       RETURN f.id AS friendId`,
      { userId },
    );
    const friends = await Promise.all(
      records.map(async (r) => {
        try {
          const user = await this.usersService.findById(r.friendId);
          return this.usersService.toPublic(user);
        } catch {
          return null;
        }
      }),
    );
    return friends.filter(Boolean);
  }

  async getPendingRequests(userId: string) {
    const records = await this.neo4j.run<{ fromId: string }>(
      `MATCH (a:User)-[r:FRIEND_REQUEST]->(b:User {id: $userId})
       RETURN a.id AS fromId`,
      { userId },
    );
    const requests = await Promise.all(
      records.map(async (r) => {
        try {
          const user = await this.usersService.findById(r.fromId);
          return this.usersService.toPublic(user);
        } catch {
          return null;
        }
      }),
    );
    return requests.filter(Boolean);
  }

  async getSentRequests(userId: string) {
    const records = await this.neo4j.run<{ toId: string }>(
      `MATCH (a:User {id: $userId})-[r:FRIEND_REQUEST]->(b:User)
       RETURN b.id AS toId`,
      { userId },
    );
    const requests = await Promise.all(
      records.map(async (r) => {
        try {
          const user = await this.usersService.findById(r.toId);
          return this.usersService.toPublic(user);
        } catch {
          return null;
        }
      }),
    );
    return requests.filter(Boolean);
  }

  async getFriendIds(userId: string): Promise<string[]> {
    const records = await this.neo4j.run<{ friendId: string }>(
      `MATCH (u:User {id: $userId})-[:FRIENDS]-(f:User) RETURN f.id AS friendId`,
      { userId },
    );
    return records.map((r) => r.friendId);
  }

  async areFriends(userId: string, otherId: string): Promise<boolean> {
    const records = await this.neo4j.run(
      `MATCH (a:User {id: $userId})-[:FRIENDS]-(b:User {id: $otherId}) RETURN b LIMIT 1`,
      { userId, otherId },
    );
    return records.length > 0;
  }

  async getFriendCount(userId: string): Promise<number> {
    const records = await this.neo4j.run<{ count: unknown }>(
      `MATCH (u:User {id: $userId})-[:FRIENDS]-(f:User) RETURN count(f) AS count`,
      { userId },
    );
    const raw = records[0]?.count;
    if (raw && typeof raw === 'object' && 'toNumber' in (raw as { toNumber: () => number })) {
      return (raw as { toNumber: () => number }).toNumber();
    }
    return Number(raw) || 0;
  }

  /** Neo4j driver returns integers as objects with toNumber() in some configs. */
  private neo4jToInt(value: unknown): number {
    if (value && typeof value === 'object' && 'toNumber' in (value as { toNumber: () => number })) {
      return (value as { toNumber: () => number }).toNumber();
    }
    return Number(value) || 0;
  }

  /**
   * Friend recommendations (Neo4j graph):
   * 1) Friend-of-friend: 2-hop via FRIENDS, ranked by distinct mutual friend count.
   * 2) Same groups: users who share MEMBER_OF groups, ranked by distinct group count.
   * Results merge and sort by mutual friends first, then shared groups.
   */
  async getSuggestions(userId: string) {
    const notContact = `suggested.id <> $userId
         AND NOT (me)-[:FRIENDS]-(suggested)
         AND NOT (me)-[:FRIEND_REQUEST]->(suggested)
         AND NOT (suggested)-[:FRIEND_REQUEST]->(me)`;

    const fofRecords = await this.neo4j.run<{ suggestedId: string; score: unknown }>(
      `MATCH (me:User {id: $userId})-[:FRIENDS]-(f:User)-[:FRIENDS]-(suggested:User)
       WHERE ${notContact}
       WITH suggested, count(DISTINCT f) AS mutualCount
       RETURN suggested.id AS suggestedId, mutualCount AS score
       ORDER BY mutualCount DESC
       LIMIT 25`,
      { userId },
    );

    const groupRecords = await this.neo4j.run<{ suggestedId: string; score: unknown }>(
      `MATCH (me:User {id: $userId})-[:MEMBER_OF]->(g:Group)<-[:MEMBER_OF]-(suggested:User)
       WHERE ${notContact}
       WITH suggested, count(DISTINCT g) AS sharedGroups
       RETURN suggested.id AS suggestedId, sharedGroups AS score
       ORDER BY sharedGroups DESC
       LIMIT 25`,
      { userId },
    );

    const scores = new Map<string, { mutualFriends: number; sharedGroups: number }>();
    for (const r of fofRecords) {
      scores.set(r.suggestedId, {
        mutualFriends: this.neo4jToInt(r.score),
        sharedGroups: 0,
      });
    }
    for (const r of groupRecords) {
      const prev = scores.get(r.suggestedId);
      const g = this.neo4jToInt(r.score);
      if (prev) {
        prev.sharedGroups = g;
      } else {
        scores.set(r.suggestedId, { mutualFriends: 0, sharedGroups: g });
      }
    }

    const ranked = [...scores.entries()].sort((a, b) => {
      const [idA, sA] = a;
      const [, sB] = b;
      if (sB.mutualFriends !== sA.mutualFriends) return sB.mutualFriends - sA.mutualFriends;
      if (sB.sharedGroups !== sA.sharedGroups) return sB.sharedGroups - sA.sharedGroups;
      return idA.localeCompare(b[0]);
    });

    const users = await Promise.all(
      ranked.slice(0, 25).map(async ([suggestedId, s]) => {
        try {
          const user = await this.usersService.findById(suggestedId);
          const reason =
            s.mutualFriends > 0 && s.sharedGroups > 0
              ? 'both'
              : s.mutualFriends > 0
                ? 'mutual_friends'
                : 'shared_groups';
          return {
            ...this.usersService.toPublic(user),
            mutualFriends: s.mutualFriends,
            sharedGroups: s.sharedGroups,
            recommendationReason: reason as 'mutual_friends' | 'shared_groups' | 'both',
          };
        } catch {
          return null;
        }
      }),
    );
    return users.filter(Boolean);
  }
}
