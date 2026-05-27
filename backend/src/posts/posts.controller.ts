import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PostsService } from './posts.service';

@Controller('posts')
@UseGuards(JwtAuthGuard)
export class PostsController {
  constructor(private postsService: PostsService) {}

  @Get('feed')
  getFeed(
    @CurrentUser() user: { userId: string },
    @Query('page') page?: string,
  ) {
    return this.postsService.getFeed(user.userId, parseInt(page || '1', 10));
  }

  @Get('user/:userId')
  getUserPosts(
    @CurrentUser() user: { userId: string },
    @Param('userId') userId: string,
  ) {
    return this.postsService.getUserPosts(userId, user.userId);
  }

  @Post()
  create(
    @CurrentUser() user: { userId: string },
    @Body() body: { content?: string; media?: { type: string; url?: string; text?: string }[]; groupId?: string },
  ) {
    return this.postsService.create(user.userId, body);
  }

  @Post(':id/reactions')
  react(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body('type') type: string,
  ) {
    return this.postsService.addReaction(id, user.userId, type || 'like');
  }

  @Get(':id/reactions')
  getReactionsDetail(@Param('id') id: string) {
    return this.postsService.getReactionsDetail(id);
  }

  @Post(':id/comments')
  comment(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() body: { content: string; mediaUrl?: string; mediaType?: string },
  ) {
    return this.postsService.addComment(id, user.userId, body);
  }

  @Post(':id/comments/:commentId/reactions')
  reactComment(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @Body('type') type: string,
  ) {
    return this.postsService.addCommentReaction(id, commentId, user.userId, type || 'like');
  }

  @Post(':id/comments/:commentId/replies')
  replyComment(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @Body() body: { content: string; mediaUrl?: string; mediaType?: string },
  ) {
    return this.postsService.addCommentReply(id, commentId, user.userId, body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.postsService.deletePost(id, user.userId);
  }
}
