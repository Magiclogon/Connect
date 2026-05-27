import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { GroupsService } from './groups.service';
import { PostsService } from '../posts/posts.service';

@Controller('groups')
@UseGuards(JwtAuthGuard)
export class GroupsController {
  constructor(
    private groupsService: GroupsService,
    private postsService: PostsService,
  ) {}

  @Get('mine')
  getMine(@CurrentUser() user: { userId: string }) {
    return this.groupsService.getMyGroups(user.userId);
  }

  @Get('discover')
  discover() {
    return this.groupsService.discover();
  }

  @Post()
  create(
    @CurrentUser() user: { userId: string },
    @Body() body: { name: string; description?: string },
  ) {
    return this.groupsService.create(user.userId, body);
  }

  @Post(':id/join')
  join(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.groupsService.join(id, user.userId);
  }

  @Post(':id/leave')
  leave(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.groupsService.leave(id, user.userId);
  }

  @Get(':id/members')
  members(@Param('id') id: string) {
    return this.groupsService.getMembers(id);
  }

  @Get(':id/posts')
  posts(@Param('id') id: string) {
    return this.groupsService.getGroupPosts(id);
  }

  @Post(':id/posts')
  createPost(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() body: { content?: string; media?: { type: string; url?: string; text?: string }[] },
  ) {
    return this.postsService.create(user.userId, { ...body, groupId: id });
  }
}
