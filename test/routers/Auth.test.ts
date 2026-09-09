import { request, agent } from '../agents';
import { describe } from 'node:test';
import { expect, test } from 'vitest';
import { returnUser } from '../factories';
import { CookieNames } from '../../src/types/Enums';

const userObject = returnUser();
const { phoneNumber, password } = userObject;

describe('POST /auth/res-signup', () => {
  test('should signup a new user successfully with 201 status code.', async () => {
    const res = await request.post('/auth/res-signup').send(userObject);

    expect(res.status).toBe(201);
    expect(res.body.phoneNumber).toMatch(userObject.phoneNumber);
    expect(res.body.password).toBe(undefined);
    expect(res.body.email).toMatch(userObject.email);
    expect(res.body.username).toMatch(userObject.username);
  });

  test('should reject signup with constraint error and 409 status code.', async () => {
    await request.post('/auth/res-signup').send(userObject);
    const res = await request.post('/auth/res-signup').send(userObject);

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch('Constraint failed');
  });
});

describe('POST /auth/res-signin', () => {
  test('should signin successfully with 200 status code.', async () => {
    await request.post('/auth/res-signup').send(userObject);
    const res = await request.post('/auth/res-signin').send({ phoneNumber, password });

    expect(res.status).toBe(200);
    expect(res.body).toBe(true);
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.headers['set-cookie']).toContainEqual(
      expect.stringContaining(CookieNames.AccessToken)
    );
    expect(res.headers['set-cookie']).toContainEqual(
      expect.stringContaining(CookieNames.SessionId)
    );
  });

  test('should reject signin with 401 status code.', async () => {
    await request.post('/auth/res-signup').send(userObject);
    const res = await request.post('/auth/res-signin').send({
      phoneNumber,
      password: 'WRONG-PASSWORD',
    });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch('Invalid credentials.');
  });

  test('should reject signin with 401 status code.', async () => {
    await request.post('/auth/res-signup').send(userObject);
    const res = await request.post('/auth/res-signin').send({
      phoneNumber: '09987654321',
      password,
    });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch('Invalid credentials.');
  });
});

describe('POST /auth/logout', () => {
  test('should logout with 200 status code.', async () => {
    await agent.post('/auth/res-signup').send(userObject);
    await agent.post('/auth/res-signin').send(userObject);
    const res = await agent.post('/auth/logout').send();

    expect(res.status).toBe(200);
    expect(res.body).toBe(true);
  });
});

// TODO: test /auth/send-otp and /auth/check-otp
// TODO: test GET /users/profile
