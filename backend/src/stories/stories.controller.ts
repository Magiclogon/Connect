import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StoriesService } from './stories.service';

@Controller('stories')
@UseGuards(JwtAuthGuard)
export class StoriesController {
  constructor(private storiesService: StoriesService) {}

  @Get('feed')
  getFeed(@CurrentUser() user: { userId: string }) {
    return this.storiesService.getFeed(user.userId);
  }

  @Post()
  create(
    @CurrentUser() user: { userId: string },
    @Body() body: { type: string; mediaUrl?: string; text?: string; backgroundColor?: string },
  ) {
    return this.storiesService.create(user.userId, body);
  }
}
