import { z } from "zod";
import type { Executor } from "../db/client";
import type { Actor, Family } from "../auth/context";
import { currentFamily } from "../auth/context";
import { listAccountsForActor } from "../domain/accounts";
import { listCategories } from "../domain/categories";
import { createTransactionEntry } from "../domain/entries";
import { dashboardSummary, spendingByCategory, incomeExpenseSeries } from "../domain/reports";
import { parseAmountToMinor } from "@/lib/money";
import { isIsoDate, monthKeyIn } from "@/lib/datetime";
import type { ToolDefinition } from "./provider";

export type ToolContext = {
  exec: Executor;
  actor: Actor;
  family: Family;
};

export type ToolHandler = (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;

type Tool = { definition: ToolDefinition; handler: ToolHandler };

function tool(name: string, description: string, schema: z.ZodTypeAny, handler: ToolHandler): Tool {
  return {
    definition: {
      type: "function",
      function: {
        name,
        description,
        // zod-to-json-schema equivalent: toJSONSchema is available in zod v4
        parameters: z.toJSONSchema(schema as z.ZodType<Record<string, unknown>>)
      }
    },
    handler
  };
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

const TOOLS: Tool[] = [
  tool(
    "list_accounts",
    "List the user's visible accounts with names, types, currencies and current balances.",
    z.object({}),
    async (_args, { exec, actor }) => {
      const accounts = await listAccountsForActor(exec, actor);
      return accounts.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        currency: a.currency,
        status: a.status,
        balanceMinor: a.displayBalanceMinor,
        owner: a.ownerId === null ? "joint" : a.ownerId === actor.userId ? "me" : "shared"
      }));
    }
  ),
  tool(
    "list_categories",
    "List the family's spending categories.",
    z.object({}),
    async (_args, { exec, actor }) => {
      return await listCategories(exec, actor.familyId);
    }
  ),
  tool(
    "query_spending",
    "Spending totals grouped by category for a date range. Amounts are positive minor units in the family currency. Omit dates for the current month.",
    z.object({
      from: isoDate.optional().describe("Inclusive start date (YYYY-MM-DD)"),
      to: isoDate.optional().describe("Inclusive end date (YYYY-MM-DD)"),
      months: z.number().int().min(1).max(24).optional().describe("Last N months including the current one; overrides from/to")
    }),
    async (args, { exec, actor, family }) => {
      let from: string | undefined = args.from as string | undefined;
      let to: string | undefined = args.to as string | undefined;
      const months = args.months as number | undefined;
      if (months) {
        const current = monthKeyIn(family.timezone);
        const start = new Date(`${current}-01T00:00:00Z`);
        start.setUTCMonth(start.getUTCMonth() - (months - 1));
        from = start.toISOString().slice(0, 10);
        to = undefined;
      }
      const range = resolveRange(family.timezone, from, to);
      return {
        range: range,
        familyCurrency: family.currency,
        byCategory: await spendingByCategory(exec, family, actor.userId, range)
      };
    }
  ),
  tool(
    "monthly_income_expense",
    "Income and expense totals per month for the last N months (default 6).",
    z.object({ months: z.number().int().min(1).max(36).optional() }),
    async (args, { exec, actor, family }) => {
      const months = (args.months as number | undefined) ?? 6;
      return {
        familyCurrency: family.currency,
        months: await incomeExpenseSeries(exec, family, actor.userId, months)
      };
    }
  ),
  tool(
    "dashboard_summary",
    "Current net worth, assets, liabilities, and this month's income and spending.",
    z.object({}),
    async (_args, { exec, actor, family }) => {
      const s = await dashboardSummary(exec, family, actor.userId);
      return {
        familyCurrency: family.currency,
        netWorthMinor: s.netWorthMinor,
        assetsMinor: s.assetsMinor,
        liabilitiesMinor: s.liabilitiesMinor,
        incomeThisMonthMinor: s.incomeThisMonthMinor,
        expenseThisMonthMinor: s.expenseThisMonthMinor,
        monthKey: s.monthKey
      };
    }
  ),
  tool(
    "create_transaction",
    "Record a new transaction. Use a NEGATIVE amount for income/received money and a POSITIVE amount for spending, consistent with the ledger's convention (positive = outflow). Dates are YYYY-MM-DD.",
    z.object({
      accountId: z.string().describe("Account id from list_accounts"),
      name: z.string().min(1).max(240),
      amount: z.number().describe("Major units, e.g. 50.25. Positive = expense, negative = income"),
      date: isoDate.optional().describe("Defaults to today"),
      categoryId: z.string().optional(),
      merchant: z.string().max(120).optional()
    }),
    async (args, ctx) => {
      const accountId = String(args.accountId ?? "");
      const name = String(args.name ?? "");
      const amount = Number(args.amount ?? 0);
      const date = args.date ? String(args.date) : monthKeyToday(ctx.family.timezone);
      if (!isIsoDate(date)) return { error: "Invalid date" };

      const account = (await listAccountsForActor(ctx.exec, ctx.actor)).find((a) => a.id === accountId);
      if (!account) return { error: "Unknown account. Call list_accounts first." };

      const amountLedgerMinor = parseAmountToMinor(amount, account.currency);
      const { entryId, duplicated } = await createTransactionEntry(ctx.exec, ctx.actor, {
        accountId,
        date,
        amountLedgerMinor,
        name,
        merchant: args.merchant ? String(args.merchant) : null,
        categoryId: args.categoryId ? String(args.categoryId) : null
      });
      return { entryId, duplicated, date, amountLedgerMinor, currency: account.currency };
    }
  )
];

function resolveRange(timezone: string, from?: string, to?: string): { from: string; to: string } {
  const today = monthKeyToday(timezone);
  if (!from) {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(1);
    from = d.toISOString().slice(0, 10);
  }
  return { from, to: to ?? today };
}

function monthKeyToday(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

const TOOL_MAP = new Map(TOOLS.map((t) => [t.definition.function.name, t]));

export function toolDefinitions(): ToolDefinition[] {
  return TOOLS.map((t) => t.definition);
}

export async function executeTool(name: string, argsJson: string, ctx: ToolContext): Promise<unknown> {
  const t = TOOL_MAP.get(name);
  if (!t) return { error: `Unknown tool: ${name}` };
  let args: Record<string, unknown>;
  try {
    args = argsJson ? JSON.parse(argsJson) : {};
  } catch {
    return { error: `Invalid JSON arguments for ${name}` };
  }
  try {
    return await t.handler(args, ctx);
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function buildToolContext(exec: Executor, actor: Actor): Promise<ToolContext> {
  return { exec, actor, family: await currentFamily(actor) };
}
