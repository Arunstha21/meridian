import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  headers: vi.fn(),
  verify: vi.fn(),
  findUser: vi.fn(),
  findSession: vi.fn(),
  touchSession: vi.fn(),
  db: vi.fn()
}));
vi.mock("next/headers", () => ({ cookies: mocks.cookies, headers: mocks.headers }));
vi.mock("@/server/db/client", () => ({ getDb: mocks.db }));
vi.mock("@/server/domain/access-users", () => ({ findAccessUser: mocks.findUser }));
vi.mock("@/server/security/session", () => ({
  findLiveSession: mocks.findSession,
  touchSession: mocks.touchSession
}));
vi.mock("@/lib/env", () => ({ requireEmailVerification: () => false }));
vi.mock("@/server/auth/access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/auth/access")>()),
  verifyAccessAssertion: mocks.verify
}));

import { loadActor } from "@/server/auth/context";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AUTH_MODE", "cloudflare-access");
  vi.stubEnv("CF_ACCESS_TEAM_DOMAIN", "rangotengo.cloudflareaccess.com");
  vi.stubEnv("CF_ACCESS_AUD", "meridian-audience");
  vi.stubEnv("CF_ACCESS_ALLOWED_EMAILS", "allowed@example.com");
  mocks.cookies.mockResolvedValue({ get: () => ({ value: "valid-local-session" }) });
  mocks.db.mockReturnValue({});
});
afterEach(() => vi.unstubAllEnvs());

describe("Access actor boundary", () => {
  it("never falls back to a session cookie or the unsigned email header", async () => {
    mocks.headers.mockResolvedValue(
      new Headers({ "cf-access-authenticated-user-email": "allowed@example.com" })
    );
    mocks.verify.mockResolvedValue(null);
    expect(await loadActor()).toBeNull();
    expect(mocks.verify).toHaveBeenCalledWith(null, expect.any(Object));
    expect(mocks.cookies).not.toHaveBeenCalled();
    expect(mocks.findSession).not.toHaveBeenCalled();
    expect(mocks.findUser).not.toHaveBeenCalled();
    expect(mocks.db).not.toHaveBeenCalled();
  });

  it("uses only the verified identity and the database's family and roles", async () => {
    mocks.headers.mockResolvedValue(new Headers({ "cf-access-jwt-assertion": "signed-assertion" }));
    const identity = { subject: "subject-1", email: "allowed@example.com" };
    mocks.verify.mockResolvedValue(identity);
    mocks.findUser.mockResolvedValue({
      id: "user-1",
      familyId: "family-1",
      familyRole: "member",
      platformRole: "user",
      email: identity.email,
      name: "Member",
      emailVerifiedAt: null
    });
    expect(await loadActor()).toMatchObject({
      userId: "user-1",
      familyId: "family-1",
      familyRole: "member",
      platformRole: "user",
      emailVerified: true,
      authProvider: "cloudflare-access",
      sessionId: ""
    });
    expect(mocks.findUser).toHaveBeenCalledWith(expect.any(Object), identity);
    expect(mocks.findSession).not.toHaveBeenCalled();
  });

  it("does not authenticate an unregistered or removed identity", async () => {
    mocks.headers.mockResolvedValue(new Headers({ "cf-access-jwt-assertion": "signed-assertion" }));
    mocks.verify.mockResolvedValue({ subject: "subject-1", email: "allowed@example.com" });
    mocks.findUser.mockResolvedValue(null);
    expect(await loadActor()).toBeNull();
  });
});
