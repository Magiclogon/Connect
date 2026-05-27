import { Body, Controller, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { FriendsService } from '../friends/friends.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private usersService: UsersService,
    private friendsService: FriendsService,
  ) {}

  @Get('search')
  async search(@Query('q') q: string, @CurrentUser() user: { userId: string }) {
    const users = await this.usersService.search(q || '', user.userId);
    return users.map((u) => this.usersService.toPublic(u));
  }

  @Get(':id')
  async getProfile(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    return this.usersService.toPublic(user);
  }

  @Get(':id/full')
  async getFullProfile(
    @Param('id') id: string,
    @CurrentUser() viewer: { userId: string },
  ) {
    const user = await this.usersService.findById(id);
    const isOwn = viewer.userId === id;
    const isFriend = isOwn || (await this.friendsService.areFriends(viewer.userId, id));
    const friendCount = await this.friendsService.getFriendCount(id);
    const friends = isFriend ? await this.friendsService.getFriends(id) : [];
    return {
      user: this.usersService.toPublic(user),
      friendCount,
      friends,
      isOwnProfile: isOwn,
      isFriend,
    };
  }

  @Put('me')
  async updateMe(
    @CurrentUser() user: { userId: string },
    @Body()
    body: {
      displayName?: string;
      bio?: string;
      avatarUrl?: string;
      coverUrl?: string;
      address?: string;
      city?: string;
      workplace?: string;
      website?: string;
    },
  ) {
    const updated = await this.usersService.updateProfile(user.userId, body);
    return this.usersService.toPublic(updated);
  }
}
