import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FriendsService } from './friends.service';

@Controller('friends')
@UseGuards(JwtAuthGuard)
export class FriendsController {
  constructor(private friendsService: FriendsService) {}

  @Get()
  getFriends(@CurrentUser() user: { userId: string }) {
    return this.friendsService.getFriends(user.userId);
  }

  @Get('requests/pending')
  getPending(@CurrentUser() user: { userId: string }) {
    return this.friendsService.getPendingRequests(user.userId);
  }

  @Get('requests/sent')
  getSent(@CurrentUser() user: { userId: string }) {
    return this.friendsService.getSentRequests(user.userId);
  }

  @Get('suggestions')
  getSuggestions(@CurrentUser() user: { userId: string }) {
    return this.friendsService.getSuggestions(user.userId);
  }

  @Post('request')
  sendRequest(
    @CurrentUser() user: { userId: string },
    @Body('toUserId') toUserId: string,
  ) {
    return this.friendsService.sendRequest(user.userId, toUserId);
  }

  @Post('accept/:fromUserId')
  accept(
    @CurrentUser() user: { userId: string },
    @Param('fromUserId') fromUserId: string,
  ) {
    return this.friendsService.acceptRequest(user.userId, fromUserId);
  }

  @Post('reject/:fromUserId')
  reject(
    @CurrentUser() user: { userId: string },
    @Param('fromUserId') fromUserId: string,
  ) {
    return this.friendsService.rejectRequest(user.userId, fromUserId);
  }
}
