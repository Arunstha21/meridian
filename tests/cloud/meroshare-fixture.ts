const calls: Array<{ path: string; authorization: string | null }> = [];
export const mockMeroShareFetch: typeof fetch = async (input, init) => {
  const url = new URL(String(input));
  const headers = new Headers(init?.headers);
  calls.push({ path: url.pathname, authorization: headers.get("authorization") });
  if (url.pathname.endsWith("/auth/")) {
    return new Response("{}", {
      status: 200,
      headers: { authorization: "Bearer short-lived-token" }
    });
  }
  if (url.pathname.endsWith("/ownDetail/")) {
    return Response.json({
      demat: "1301000000000001",
      clientCode: "CLIENT-1",
      name: "Asha Shrestha"
    });
  }
  if (url.pathname.endsWith("/myPortfolio/")) {
    return Response.json({
      totalItems: 1,
      totalValueOfLastTransPrice: "25062.50",
      meroShareMyPortfolio: [
        {
          script: "NABIL",
          scriptDesc: "Nabil Bank",
          currentBalance: "100",
          lastTransactionPrice: "250.625"
        }
      ]
    });
  }
  if (url.pathname.endsWith("/myTransaction/")) {
    return Response.json({
      totalItems: 1,
      transactionView: [
        {
          script: "NABIL",
          scriptDesc: "Nabil Bank",
          creditQty: "100",
          debitQty: "0",
          balAfterTrans: "100",
          transactionDate: "2026-08-20",
          historyDesc: "IPO allotment",
          transCode: "IPO"
        }
      ]
    });
  }
  if (url.pathname.endsWith("/waccReport/")) {
    return Response.json({
      waccReportResponse: [{ scrip: "NABIL", averageBuyRate: "250.625" }]
    });
  }
  return new Response("not found", { status: 404 });
};
