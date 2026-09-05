import { beforeAll, describe, expect, it } from "vitest";
import { GET } from "@/app/api/health/route";
import { truncateAll } from "../helpers";

beforeAll(async () => {
  await truncateAll();
});

describe("health endpoint", () => {
  it("returns 200 when the database and migrations are current", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; db: boolean; migrations: string };
    expect(body).toMatchObject({ status: "ok", db: true, migrations: "current" });
  });
});
