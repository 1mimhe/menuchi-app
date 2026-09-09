import supertest from 'supertest';
import createServer from '../src/server';

let cachedApp: ReturnType<typeof createServer> | undefined;

function app(): ReturnType<typeof createServer> {
  if (!cachedApp) cachedApp = createServer();
  return cachedApp;
}

/** Stateless requests (no cookie jar). Lazily creates one shared app. */
export const request = new Proxy({} as ReturnType<typeof supertest>, {
  get(_target, prop) {
    const agent = supertest(app());
    const value = (agent as unknown as Record<PropertyKey, unknown>)[prop as string];
    return typeof value === 'function'
      ? (value as (...args: unknown[]) => unknown).bind(agent)
      : value;
  },
});

let cachedAgent: ReturnType<typeof supertest.agent> | undefined;

function statefulAgent(): ReturnType<typeof supertest.agent> {
  if (!cachedAgent) cachedAgent = supertest.agent(app());
  return cachedAgent;
}

/** Stateful agent with cookie jar (single shared instance, lazy app). */
export const agent: ReturnType<typeof supertest.agent> = new Proxy(
  {} as ReturnType<typeof supertest.agent>,
  {
    get(_target, prop) {
      const instance = statefulAgent() as unknown as Record<PropertyKey, unknown>;
      const value = instance[prop as string];
      return typeof value === 'function'
        ? (value as (...args: unknown[]) => unknown).bind(instance)
        : value;
    },
  }
);

/** Per-test login helper — returns cookies for authenticated requests. */
export async function loginAsOwner(
  appInstance: ReturnType<typeof createServer>,
  phoneNumber: string,
  password: string
): Promise<string[]> {
  const res = await supertest(appInstance).post('/auth/res-signin').send({ phoneNumber, password });
  const cookies = res.headers['set-cookie'] as unknown;
  return Array.isArray(cookies) ? (cookies as string[]) : [];
}
