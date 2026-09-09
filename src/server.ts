import './config/env';
import crypto from 'crypto';
import express from 'express';
import { errorHandler, notFoundHandler, errorPreprocessor } from './middlewares/ErrorHandler';
import { RegisterRoutes } from './routes';
import swaggerUi from 'swagger-ui-express';
import * as swagger from './config/swagger.json';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import { logger } from './lib/logger';
import { getEnv } from './config/env';
import { createContainer, Container } from './container';
import sessionConfig from './config/SessionConfig';
import cookieParser from 'cookie-parser';

export default function createServer(container?: Container) {
  // Single env source — validated by zod, fails fast on boot.
  const env = getEnv();

  const app = express();
  app.locals.container = container ?? createContainer();

  // Required for Secure cookies behind reverse proxies (Docker/Nginx).
  app.set('trust proxy', 1);

  app.use(helmet({ crossOriginResourcePolicy: false }));
  // Brute-force protection for auth endpoints.
  app.use(
    '/auth',
    rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false })
  );
  app.use(
    '/auth/send-otp',
    rateLimit({ windowMs: 10 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false })
  );

  const allowedOrigins = (env.MENUCHI_FRONT_URL ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.use(
    cors({
      origin: allowedOrigins.length ? allowedOrigins : false,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    })
  );
  app.use(
    pinoHttp({
      logger,
      genReqId: () => crypto.randomUUID(),
    })
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser(env.COOKIE_PRIVATE_KEY));
  app.use(sessionConfig());

  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swagger));
  RegisterRoutes(app);
  // 404 for unknown routes must come before error middleware (4-arg
  // handlers never see unmatched routes).
  app.use(notFoundHandler);
  app.use(errorPreprocessor);
  app.use(errorHandler);

  return app;
}
