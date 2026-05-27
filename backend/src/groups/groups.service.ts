import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Neo4jService } from '../neo4j/neo4j.service';
import { PostsService } from '../posts/posts.service';
import { UsersService } from '../users/users.service';
import { Group, GroupDocument } from './schemas/group.schema';

@Injectable()
export class GroupsService {
  constructor(
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
    private neo4j: Neo4jService,
    private usersService: UsersService,
    private postsService: PostsService,
  ) {}

  async create(ownerId: string, data: { name: string; description?: string }) {
    const neo4jId = uuidv4();
    await this.neo4j.run(
      `CREATE (g:Group {id: $id, name: $name, createdAt: datetime()})
       WITH g MATCH (u:User {id: $ownerId}) CREATE (u)-[:OWNS]->(g), (u)-[:MEMBER_OF {role: 'admin', joinedAt: datetime()}]->(g)`,
      { id: neo4jId, name: data.name, ownerId },
    );
    const group = await this.groupModel.create({
      neo4jId,
      name: data.name,
      description: data.description || '',
      ownerId,
    });
    return this.enrichGroup(group);
  }

  async join(groupId: string, userId: string) {
    const group = await this.groupModel.findById(groupId);
    if (!group) throw new NotFoundException('Groupe introuvable');
    await this.neo4j.run(
      `MATCH (g:Group {id: $neo4jId}), (u:User {id: $userId})
       MERGE (u)-[:MEMBER_OF {role: 'member', joinedAt: datetime()}]->(g)`,
      { neo4jId: group.neo4jId, userId },
    );
    return { message: 'Vous avez rejoint le groupe' };
  }

  async leave(groupId: string, userId: string) {
    const group = await this.groupModel.findById(groupId);
    if (!group) throw new NotFoundException('Groupe introuvable');
    if (group.ownerId === userId) throw new ForbiddenException('Le propriétaire ne peut pas quitter');
    await this.neo4j.run(
      `MATCH (u:User {id: $userId})-[r:MEMBER_OF]->(g:Group {id: $neo4jId}) DELETE r`,
      { neo4jId: group.neo4jId, userId },
    );
    return { message: 'Vous avez quitté le groupe' };
  }

  async getMyGroups(userId: string) {
    const records = await this.neo4j.run<{ neo4jId: string }>(
      `MATCH (u:User {id: $userId})-[:MEMBER_OF]->(g:Group) RETURN g.id AS neo4jId`,
      { userId },
    );
    const neo4jIds = records.map((r) => r.neo4jId);
    const groups = await this.groupModel.find({ neo4jId: { $in: neo4jIds } });
    return Promise.all(groups.map((g) => this.enrichGroup(g)));
  }

  async discover() {
    const groups = await this.groupModel.find().sort({ createdAt: -1 }).limit(20);
    return Promise.all(groups.map((g) => this.enrichGroup(g)));
  }

  async getMembers(groupId: string) {
    const group = await this.groupModel.findById(groupId);
    if (!group) throw new NotFoundException('Groupe introuvable');
    const records = await this.neo4j.run<{ userId: string; role: string }>(
      `MATCH (u:User)-[r:MEMBER_OF]->(g:Group {id: $neo4jId})
       RETURN u.id AS userId, r.role AS role`,
      { neo4jId: group.neo4jId },
    );
    return Promise.all(
      records.map(async (r) => {
        try {
          const user = await this.usersService.findById(r.userId);
          return { ...this.usersService.toPublic(user), role: r.role };
        } catch {
          return null;
        }
      }),
    ).then((m) => m.filter(Boolean));
  }

  async getGroupPosts(groupId: string) {
    return this.postsService.getGroupPosts(groupId);
  }

  private async enrichGroup(group: GroupDocument) {
    const memberCount = await this.neo4j.run<{ count: unknown }>(
      `MATCH (u:User)-[:MEMBER_OF]->(g:Group {id: $neo4jId}) RETURN count(u) AS count`,
      { neo4jId: group.neo4jId },
    );
    const raw = memberCount[0]?.count;
    const count =
      raw && typeof raw === 'object' && 'toNumber' in (raw as { toNumber: () => number })
        ? (raw as { toNumber: () => number }).toNumber()
        : Number(raw) || 0;
    return {
      id: group._id.toString(),
      name: group.name,
      description: group.description,
      avatarUrl: group.avatarUrl,
      ownerId: group.ownerId,
      memberCount: count,
      createdAt: (group as GroupDocument & { createdAt?: Date }).createdAt,
    };
  }
}
