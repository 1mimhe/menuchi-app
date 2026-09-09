import 'express-session';
import { ExpressSession } from '../AuthTypes';

declare module 'express-session' {
  interface SessionData extends ExpressSession {
    lastAccessed: Date;
  }
}
