import { RedisStore } from 'connect-redis';
import session from 'express-session';
import { CookieNames } from '../types/Enums';
import { getRedisClient } from './RedisClient';
import { getEnv } from './env';

export default function sessionConfig() {
  const env = getEnv();
  const redisStore = new RedisStore({
    client: getRedisClient(),
    prefix: 'session:',
  });

  return session({
    name: CookieNames.SessionId,
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: redisStore,
    cookie: {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 2 * 24 * 3600 * 1000,
      path: '/',
    },
  });
}
