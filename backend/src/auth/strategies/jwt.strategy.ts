import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private redis: RedisService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'dev-secret',
      passReqToCallback: true,
    });
  }

  async validate(req: { headers?: { authorization?: string } }, payload: { sub: string; email: string }) {
    const token = req.headers?.authorization?.replace('Bearer ', '') || '';
    const blacklisted = await this.redis.get(`blacklist:${token}`);
    if (blacklisted) throw new UnauthorizedException('Session expirée');
    return { userId: payload.sub, email: payload.email };
  }
}
