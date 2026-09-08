import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import type { Executor } from "../src/server/db/migrate-types";
import { migrateUp } from "../src/server/db/migrate";
import { ensureDefaultFlags } from "../src/server/flags";
import { hashPassword } from "../src/lib/crypto";
import { env } from "../src/lib/env";
import * as accountsSvc from "../src/server/domain/accounts";
import * as categoriesSvc from "../src/server/domain/categories";
import * as tagsSvc from "../src/server/domain/tags";
import * as orchestrate from "../src/server/domain/orchestrate";
import * as valuationsSvc from "../src/server/domain/valuations";
import * as exchangeRatesSvc from "../src/server/domain/exchange-rates";
import { recalculateAccount } from "../src/server/domain/balances";

function actorOf(userId: string, familyId: string) {
  return {
    userId,
    sessionId: "seed",
    familyId,
    familyRole: "admin" as const,
    platformRole: "user" as const,
    email: "",
    name: "",
    emailVerified: true
  };
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

async function main() {
  if (env.SEED_DEMO !== "true") {
    console.log("Seeding skipped. Set SEED_DEMO=true to create demo data.");
    return;
  }

  const db = drizzle(process.env.DATABASE_URL!) as unknown as Executor;
  await migrateUp();

  const email = "demo@meridian.local";
  const existing = await db.execute<{ id: string }>(
    sql`SELECT id::text AS id FROM users WHERE lower(email) = ${email}`
  );
  if ((existing.rows ?? []).length > 0 && !process.argv.includes("--force")) {
    console.log("Demo data already present (use --force to wipe and reseed).");
        return;
  }
  if ((existing.rows ?? []).length > 0) {
    await db.execute(sql`
      DELETE FROM families WHERE id IN (SELECT family_id FROM users WHERE lower(email) = ${email})
    `);
  }

  const password = env.SEED_PASSWORD ?? "meridian-demo-2026";
  const hash = await hashPassword(password);

  const familyRes = await db.execute<{ id: string }>(sql`
    INSERT INTO families (name, currency, timezone)
    VALUES ('Demo Household', 'USD', 'Etc/UTC')
    RETURNING id::text AS id
  `);
  const familyId = familyRes.rows![0]!.id;

  const adminRes = await db.execute<{ id: string }>(sql`
    INSERT INTO users (family_id, email, password_hash, name, family_role, platform_role, email_verified_at)
    VALUES (${familyId}::uuid, ${email}, ${hash}, 'Demo Admin', 'admin', 'user'::text, now())
    RETURNING id::text AS id
  `);
  const partnerRes = await db.execute<{ id: string }>(sql`
    INSERT INTO users (family_id, email, password_hash, name, family_role, email_verified_at)
    VALUES (${familyId}::uuid, 'partner@meridian.local', ${hash}, 'Demo Partner', 'member', now())
    RETURNING id::text AS id
  `);
  const adminId = adminRes.rows![0]!.id;
  const partnerId = partnerRes.rows![0]!.id;
  const actor = actorOf(adminId, familyId);

  for (const [base, quote, rate] of [
    ["USD", "EUR", "0.92"],
    ["USD", "GBP", "0.79"],
    ["USD", "CAD", "1.36"],
    ["USD", "NPR", "133.5"],
    ["USD", "JPY", "155.2"]
  ] as const) {
    await exchangeRatesSvc.upsertRate(db, { base, quote, rate, quotedOn: isoDaysAgo(200) });
    await exchangeRatesSvc.upsertRate(db, {
      base,
      quote,
      rate: String(Number(rate) * 0.995),
      quotedOn: isoDaysAgo(10)
    });
  }

  const catIds: Record<string, string> = {};
  for (const [name, parent] of [
    ["Income", null],
    ["Salary", "Income"],
    ["Interest", "Income"],
    ["Housing", null],
    ["Rent", "Housing"],
    ["Utilities", "Housing"],
    ["Food", null],
    ["Groceries", "Food"],
    ["Restaurants", "Food"],
    ["Transport", null],
    ["Transit", "Transport"],
    ["Health", null],
    ["Shopping", null],
    ["Subscriptions", null],
    ["Travel", null],
    ["Fees", null]
  ] as const) {
    const res = await categoriesSvc.createCategory(db, actor, {
      name,
      parentId: parent ? catIds[parent]! : null
    });
    catIds[name!] = res.categoryId;
  }

  await tagsSvc.createTag(db, actor, { name: "reimbursable" });
  const subscriptionTag = await tagsSvc.createTag(db, actor, { name: "subscription" });

  const checking = (
    await accountsSvc.createAccount(db, actor, {
      type: "depository",
      name: "Everyday Checking",
      currency: "USD",
      institution: "First Community Bank",
      openingBalanceDisplayMinor: 250000,
      openedOn: isoDaysAgo(120),
      includedInReports: true,
      joint: true
    })
  ).accountId;

  const savings = (
    await accountsSvc.createAccount(db, actor, {
      type: "depository",
      name: "High-Yield Savings",
      currency: "USD",
      institution: "Online Savings Co",
      openingBalanceDisplayMinor: 1500000,
      openedOn: isoDaysAgo(120),
      includedInReports: true,
      joint: true
    })
  ).accountId;

  const card = (
    await accountsSvc.createAccount(db, actor, {
      type: "credit_card",
      name: "Rewards Card",
      currency: "USD",
      institution: "Card Issuer",
      openingBalanceDisplayMinor: 0,
      openedOn: isoDaysAgo(120),
      includedInReports: true,
      joint: true
    })
  ).accountId;

  const car = (
    await accountsSvc.createAccount(db, actor, {
      type: "other_asset",
      name: "Family Car",
      currency: "USD",
      subtype: "Vehicle",
      openingBalanceDisplayMinor: 1400000,
      openedOn: isoDaysAgo(120),
      includedInReports: true,
      joint: false
    })
  ).accountId;

  await accountsSvc.shareAccount(db, actor, car, partnerId, "read_only");

  for (let day = 120; day >= 0; day--) {
    const date = isoDaysAgo(day);

    if (day % 14 === 3) {
      await orchestrate.addTransaction(db, actor, {
        accountId: checking,
        date,
        amountLedgerMinor: -520000,
        name: "Biweekly salary",
        categoryId: catIds["Salary"]!,
        merchant: "Employer"
      });
    }
    if (day % 30 === 1) {
      await orchestrate.addTransaction(db, actor, {
        accountId: checking,
        date,
        amountLedgerMinor: 195000,
        name: "Apartment rent",
        categoryId: catIds["Rent"]!,
        merchant: "Landlord LLC"
      });
      await orchestrate.addTransaction(db, actor, {
        accountId: checking,
        date,
        amountLedgerMinor: 8900,
        name: "Electricity",
        categoryId: catIds["Utilities"]!
      });
      await orchestrate.addTransaction(db, actor, {
        accountId: savings,
        date,
        amountLedgerMinor: -2100,
        name: "Savings interest",
        categoryId: catIds["Interest"]!
      });
    }
    if ([2, 5].includes(day % 7)) {
      await orchestrate.addTransaction(db, actor, {
        accountId: card,
        date,
        amountLedgerMinor: Math.round(3500 + ((day * 977) % 6000)),
        name: "Supermarket",
        categoryId: catIds["Groceries"]!
      });
    }
    if (day % 11 === 4) {
      await orchestrate.addTransaction(db, actor, {
        accountId: card,
        date,
        amountLedgerMinor: Math.round(1800 + ((day * 613) % 4200)),
        name: "Restaurant",
        categoryId: catIds["Restaurants"]!
      });
    }
    if (day % 6 === 2) {
      await orchestrate.addTransaction(db, actor, {
        accountId: checking,
        date,
        amountLedgerMinor: 2750,
        name: "Metro top-up",
        categoryId: catIds["Transit"]!
      });
    }
    if (day % 30 === 12) {
      await orchestrate.addTransaction(db, actor, {
        accountId: card,
        date,
        amountLedgerMinor: 1599,
        name: "Streaming service",
        categoryId: catIds["Subscriptions"]!,
        tagIds: [subscriptionTag.tagId]
      });
    }
    if (day % 30 === 15 && day > 4) {
      const amount = Math.round(30000 + ((day * 379) % 30000));
      await orchestrate.makeTransferWithEntries(db, actor, {
        fromAccountId: checking,
        toAccountId: card,
        date,
        amountDisplayMinor: amount,
        name: "Credit card payment"
      });
    }
  }

  await valuationsSvc.recordValuation(db, actor, {
    accountId: car,
    date: isoDaysAgo(90),
    amountDisplayMinor: 1350000,
    kind: "reconciliation"
  });

  for (const accountId of [checking, savings, card, car]) {
    await recalculateAccount(db, accountId);
  }

  await ensureDefaultFlags(db);

  console.log("Demo data seeded:");
  console.log(`  sign-in: ${email}`);
  console.log(`  password: ${password}`);
  console.log("  platform admin: npm run admin:promote -- <your-email>");
  }

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
