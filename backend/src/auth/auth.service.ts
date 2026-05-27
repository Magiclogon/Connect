import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RedisService } from '../redis/redis.service';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private redis: RedisService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email déjà utilisé');
    const hashed = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.create({
      email: dto.email,
      password: hashed,
      displayName: dto.displayName,
    });
    return this.buildAuthResponse(user._id.toString(), user.email, user.displayName);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Identifiants invalides');
    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Identifiants invalides');
    return this.buildAuthResponse(user._id.toString(), user.email, user.displayName);
  }

  async logout(userId: string, token: string) {
    await this.redis.set(`blacklist:${token}`, '1', 60 * 60 * 24 * 7);
    await this.redis.del(`session:${userId}`);
  }

  private async buildAuthResponse(userId: string, email: string, displayName: string) {
    const payload = { sub: userId, email };
    const accessToken = this.jwtService.sign(payload);
    await this.redis.set(`session:${userId}`, accessToken, 60 * 60 * 24 * 7);
    return {
      accessToken,
      user: { id: userId, email, displayName },
    };
  }
}
