import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PostsModule } from './posts/posts.module';
import { MessagesModule } from './messages/messages.module';
import { StoriesModule } from './stories/stories.module';
import { GroupsModule } from './groups/groups.module';
import { FriendsModule } from './friends/friends.module';
import { Neo4jModule } from './neo4j/neo4j.module';
import { RedisModule } from './redis/redis.module';
import { MediaModule } from './media/media.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ChatGateway } from './chat/chat.gateway';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost:27017/socialmedia'),
    Neo4jModule,
    RedisModule,
    AuthModule,
    UsersModule,
    FriendsModule,
    PostsModule,
    MessagesModule,
    StoriesModule,
    GroupsModule,
    NotificationsModule,
    MediaModule,
  ],
  controllers: [AppController],
  providers: [ChatGateway],
})
export class AppModule {}
