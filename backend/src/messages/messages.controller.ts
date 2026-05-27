import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MessagesService } from './messages.service';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private messagesService: MessagesService) {}

  @Get('unread-count')
  unreadCount(@CurrentUser() user: { userId: string }) {
    return this.messagesService.getTotalUnreadCount(user.userId);
  }

  @Get('conversations')
  getConversations(@CurrentUser() user: { userId: string }) {
    return this.messagesService.getConversations(user.userId);
  }

  @Get('conversations/:id')
  getConversation(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ) {
    return this.messagesService.getConversationById(id, user.userId);
  }

  @Post('conversations/:otherUserId')
  getOrCreate(
    @CurrentUser() user: { userId: string },
    @Param('otherUserId') otherUserId: string,
  ) {
    return this.messagesService.getOrCreatePrivate(user.userId, otherUserId);
  }

  @Post('conversations/:id/send')
  send(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() body: { type: string; content?: string; mediaUrl?: string },
  ) {
    return this.messagesService.sendMessage(id, user.userId, body);
  }

  @Post('conversations/:id/read')
  markRead(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.messagesService.markRead(id, user.userId);
  }
}
