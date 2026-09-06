import { RedisStore } from 'connect-redis';
import session from 'express-session';
import { CookieNames } from '../types/Enums';
import RedisClient from './RedisClient';

export default function sessionConfig() {
  const redisStore = new RedisStore({
    client: RedisClient,
    prefix: 'session:',
  });

  return session({
    name: CookieNames.SessionId,
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    store: redisStore,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 2 * 24 * 3600 * 1000,
      path: '/',
    },
  });
}
