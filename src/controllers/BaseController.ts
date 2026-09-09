import { Controller } from 'tsoa';
import { SessionUpdate, UserSession } from '../types/AuthTypes';
import { UUID } from '../types/TypeAliases';
import { PermissionScope, SessionUpdateScope, SyncOperations } from '../types/Enums';
import { ForbiddenError } from '../exceptions/AuthError';
import { getTransformersRedisClient } from '../config/TransformersRedisClient';
import { canAccess } from '../auth/permissionGuard';
import { applySessionUpdate } from '../auth/sessionSync';
import { publishImageEvent } from '../events/imageEvents';

function resolveStreamName(explicit?: string): string {
  if (explicit) return explicit;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getEnv } = require('../config/env') as typeof import('../config/env');
    return getEnv().TRANSFORMERS_STREAM;
  } catch {
    return process.env.TRANSFORMERS_STREAM as string;
  }
}

/**
 * Thin TSOA compatibility facade.
 * Real logic lives in auth/permissionGuard, auth/sessionSync, events/imageEvents.
 * Controllers keep extending this class so no controller signatures change.
 */
export default class BaseController extends Controller {
  constructor() {
    super();
  }

  checkPermission(user?: UserSession, by?: PermissionScope, id?: UUID) {
    if (!canAccess(user, by, id)) throw new ForbiddenError();
  }

  updateSession(scope: SessionUpdateScope, update: SessionUpdate) {
    applySessionUpdate(scope, update);
  }

  async publish(
    streamName?: string,
    key?: string | null,
    operation?: SyncOperations,
    oldKey?: string | null
  ) {
    await publishImageEvent(
      getTransformersRedisClient(),
      resolveStreamName(streamName),
      key,
      operation,
      oldKey
    );
  }
}
