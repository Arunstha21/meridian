import { describe, it, expect, beforeAll } from "vitest";
import { db, makeUser, makeAccount, addTxn, truncateAll, actorOf } from "../helpers";
import { executeTool, buildToolContext } from "@/server/ai/tools";
import { listEntriesPage } from "@/server/domain/entries";
import { validateLocale, updateFamilySettings } from "@/server/domain/families";
import { loadHistory, appendUserMessage, appendAssistantMessage } from "@/server/domain/chat";

beforeAll(async () => {
  await truncateAll();
});

describe("Step 6: AI Tool Runtime Schema Enforcement", () => {
  it("rejects tool calls with invalid arguments with a schema error", async () => {
    const user = await makeUser();
    const ctx = await buildToolContext(db(), actorOf(user));

    // tool 'query_spending' expects optional months as number (1-24)
    // If invalid types/ranges are supplied:
    const res = await executeTool(
      "query_spending",
      JSON.stringify({ months: "not-a-number" }),
      ctx
    );
    expect(res).toBeDefined();
    expect((res as { error: string }).error).toContain("Invalid tool arguments for query_spending");

    const outOfRange = await executeTool("query_spending", JSON.stringify({ months: 999 }), ctx);
    expect((outOfRange as { error: string }).error).toContain(
      "Invalid tool arguments for query_spending"
    );
  });

  it("executes tool calls when arguments match the schema", async () => {
    const user = await makeUser();
    const ctx = await buildToolContext(db(), actorOf(user));

    const res = await executeTool("query_spending", JSON.stringify({ months: 3 }), ctx);
    expect(res).toBeDefined();
    expect((res as { error?: string }).error).toBeUndefined();
    expect((res as { byCategory?: unknown[] }).byCategory).toBeDefined();
  });
});

describe("Step 6: Transaction Discovery and Parameter Hardening", () => {
  it("handles malformed UUIDs and cursor without crashing and searches by merchant", async () => {
    const user = await makeUser();
    const accountId = await makeAccount(user, { name: "Checking" });

    // Record an entry with a specific merchant
    await addTxn(user, accountId, {
      amountLedgerMinor: 4500,
      name: "Office Supplies",
      merchant: "Acme Superstore"
    });

    // 1. Search by merchant name matches
    const searchRes = await listEntriesPage(db(), actorOf(user), {
      search: "Acme",
      limit: 10
    });
    expect(searchRes.items).toHaveLength(1);
    expect(searchRes.items[0]?.name).toBe("Office Supplies");

    // 2. Malformed accountId, categoryId, and tagId do not crash PostgreSQL
    const malformedRes = await listEntriesPage(db(), actorOf(user), {
      accountId: "not-a-uuid",
      categoryId: "invalid-category-id",
      tagId: "fake-tag",
      limit: 10
    });
    expect(malformedRes.items).toBeDefined();

    // 3. Malformed cursor does not crash
    const malformedCursorRes = await listEntriesPage(db(), actorOf(user), {
      cursor: { date: "invalid-date", id: "not-a-uuid" },
      limit: 10
    });
    expect(malformedCursorRes.items).toBeDefined();
  });
});

describe("Step 6: Localization & Locale Validation", () => {
  it("validates standard BCP 47 locale codes and rejects invalid locales", async () => {
    expect(validateLocale("en-US")).toBe("en-US");
    expect(validateLocale("de-DE")).toBe("de-DE");
    expect(validateLocale("ne-NP")).toBe("ne-NP");

    expect(() => validateLocale("invalid_locale_xyz_12345")).toThrow();
  });

  it("rejects invalid locale in updateFamilySettings", async () => {
    const user = await makeUser();
    await expect(
      updateFamilySettings(db(), actorOf(user), { locale: "non-existent-locale-code-99" })
    ).rejects.toThrow();
  });
});

describe("Step 6: Chat History SQL Optimization", () => {
  it("loads only the recent messages in correct chronological order", async () => {
    const user = await makeUser();

    // Insert 10 messages
    for (let i = 1; i <= 10; i++) {
      await appendUserMessage(db(), user.familyId, user.userId, `Message ${i}`);
      await appendAssistantMessage(db(), user.familyId, user.userId, `Response ${i}`);
    }

    // Load with a limit of 4
    const history = await loadHistory(db(), user.familyId, user.userId, 4);
    expect(history.length).toBeLessThanOrEqual(4);
    // Chronological order preserved
    expect(history[history.length - 1]?.content).toBe("Response 10");
  });
});
