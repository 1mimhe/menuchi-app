import dotenv from 'dotenv';
import express from 'express';
import { errorHandler, notFoundHandler, errorPreprocessor } from './middlewares/ErrorHandler';
import { RegisterRoutes } from './routes';
import swaggerUi from 'swagger-ui-express';
import * as swagger from './config/swagger.json';
import morgan from 'morgan';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import './config/RedisClient';
import './config/TransformersRedisClient';
import './config/OtpRedisClient';
import sessionConfig from './config/SessionConfig';
import cookieParser from 'cookie-parser';

export default function createServer() {
  dotenv.config({ path: process.env.NODE_ENV?.trim() === 'test' ? '.env.test' : '.env' });

  const app = express();

  // Required for Secure cookies behind reverse proxies (Docker/Nginx).
  app.set('trust proxy', 1);

  app.use(helmet({ crossOriginResourcePolicy: false }));
  // Brute-force protection for auth endpoints.
  app.use('/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false }));
  app.use('/auth/send-otp', rateLimit({ windowMs: 10 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false }));

  const allowedOrigins = (process.env.MENUCHI_FRONT_URL ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.use(cors({
    origin: allowedOrigins.length ? allowedOrigins : false,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  }));
  app.use(morgan(':date[web] | :url <:method, :status> | :response-time[3]ms'));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser(process.env.COOKIE_PRIVATE_KEY));
  app.use(sessionConfig());

  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swagger));
  RegisterRoutes(app);
  app.use(errorPreprocessor)
  app.use(errorHandler);
  app.use(notFoundHandler);

  return app;
}