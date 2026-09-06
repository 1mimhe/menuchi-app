import { describe, expect, test } from "vitest";
import supertest from "supertest";
import { randomUUID } from "crypto";
import createServer from "../../src/server";

// NOTE: this file intentionally does NOT mock BaseController.checkPermission.
// It proves real HTTP enforcement after removing the NODE_ENV=test bypass.

type TestAgent = ReturnType<typeof supertest.agent>;

function uniquePhone() {
  const suffix = Math.floor(10000000 + Math.random() * 89999999).toString();
  return `09${suffix}`;
}

function uniqueRestaurant(displayPrefix = "authz-rest") {
  const tag = randomUUID().slice(0, 8);
  return {
    name: "AuthZ Restaurant",
    displayName: `${displayPrefix}-${tag}`,
  };
}

async function signupAndSignin(agent: TestAgent) {
  const phoneNumber = uniquePhone();
  const password = "P@ssword1234";
  const username = `u-${randomUUID().slice(0, 8)}`;
  const email = `${randomUUID().slice(0, 8)}@example.com`;

  const signup = await agent.post("/auth/res-signup").send({ phoneNumber, password, username, email });
  expect(signup.status).toBe(201);

  const signin = await agent.post("/auth/res-signin").send({ phoneNumber, password });
  expect(signin.status).toBe(200);
}

describe("AuthZ enforcement (Phase-1)", () => {
  test("GET /restaurants/{id} rejects cross-owner access with 403", async () => {
    const appA = createServer();
    const appB = createServer();
    const agentA = supertest.agent(appA);
    const agentB = supertest.agent(appB);
    await signupAndSignin(agentA);
    await signupAndSignin(agentB);

    const created = await agentA.post("/restaurants").send(uniqueRestaurant());
    expect(created.status).toBe(201);
    const restaurantId = created.body.id as string;
    expect(restaurantId).toBeDefined();

    const forbidden = await agentB.get(`/restaurants/${restaurantId}`);
    expect(forbidden.status).toBe(403);

    const allowed = await agentA.get(`/restaurants/${restaurantId}`);
    expect(allowed.status).toBe(200);
  });

  test("GET /branches/{id} rejects cross-owner access with 403", async () => {
    const appA = createServer();
    const appB = createServer();
    const agentA = supertest.agent(appA);
    const agentB = supertest.agent(appB);
    await signupAndSignin(agentA);
    await signupAndSignin(agentB);

    const created = await agentA.post("/restaurants").send(uniqueRestaurant("authz-branch"));
    expect(created.status).toBe(201);
    const branchId = created.body.branches?.[0]?.id as string;
    expect(branchId).toBeDefined();

    const forbidden = await agentB.get(`/branches/${branchId}`);
    expect(forbidden.status).toBe(403);

    const allowed = await agentA.get(`/branches/${branchId}`);
    expect(allowed.status).toBe(200);
  });

  test("GET /menus/{id} rejects cross-owner access with 403", async () => {
    const appA = createServer();
    const appB = createServer();
    const agentA = supertest.agent(appA);
    const agentB = supertest.agent(appB);
    await signupAndSignin(agentA);
    await signupAndSignin(agentB);

    const created = await agentA.post("/restaurants").send(uniqueRestaurant("authz-menu"));
    expect(created.status).toBe(201);
    const branchId = created.body.branches?.[0]?.id as string;
    expect(branchId).toBeDefined();

    const menuRes = await agentA.post("/menus").send({ branchId, name: "authz-menu" });
    expect(menuRes.status).toBe(201);
    const menuId = menuRes.body.id as string;
    expect(menuId).toBeDefined();

    const forbidden = await agentB.get(`/menus/${menuId}`);
    expect(forbidden.status).toBe(403);

    const allowed = await agentA.get(`/menus/${menuId}`);
    expect(allowed.status).toBe(200);
  });
});
