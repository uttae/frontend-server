import { beforeEach, expect, it, vi } from "vitest";
const fetcher = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", () => ({ apiFetch: fetcher }));
vi.mock("@/lib/api/config", () => ({ API_BASE: "http://fixture" }));
import {
  createExpense,
  patchExpense,
  deleteExpense,
  getExpenses,
  getExpenseSummary,
  getExpenseCurrencies,
} from "./expenses";
beforeEach(() => fetcher.mockReset());
it("uses exact unenveloped REST contract and string money", async () => {
  const body = {
    expenseGroup: "PREPARATION" as const,
    scheduleId: null,
    scheduleItemId: null,
    totalAmount: "999999999999999.99",
    currency: "USD",
    category: "OTHER" as const,
    memo: "",
    payerUserIds: [1, 2],
    participantUserIds: [1, 2, 3],
  };
  fetcher.mockResolvedValue(
    new Response(JSON.stringify({ ...body, id: 10 }), { status: 201 }),
  );
  expect((await createExpense("room", body)).totalAmount).toBe(
    body.totalAmount,
  );
  expect(fetcher.mock.calls[0][0]).toBe("http://fixture/rooms/room/expenses");
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual(body);
  fetcher.mockResolvedValue(new Response(JSON.stringify({ ...body, id: 10 })));
  await patchExpense("room", 10, { memo: null });
  expect(fetcher.mock.calls[1][1].method).toBe("PATCH");
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ memo: null });
  fetcher.mockResolvedValue(new Response(null, { status: 204 }));
  await expect(deleteExpense("room", 10)).resolves.toBeUndefined();
});
it("reads lists summary currencies and preserves server error code", async () => {
  for (const [fn, path, payload] of [
    [getExpenses, "", []],
    [getExpenseSummary, "/summary", { currencies: [] }],
    [getExpenseCurrencies, "/currencies", []],
  ] as const) {
    fetcher.mockResolvedValue(new Response(JSON.stringify(payload)));
    expect(await fn("r")).toEqual(payload);
    expect(fetcher.mock.lastCall?.[0]).toBe(
      `http://fixture/rooms/r/expenses${path}`,
    );
  }
  fetcher.mockResolvedValue(
    new Response(
      JSON.stringify({
        code: "INVALID_EXPENSE_AMOUNT",
        message: "금액을 확인해 주세요",
      }),
      { status: 400 },
    ),
  );
  await expect(getExpenses("r")).rejects.toMatchObject({
    code: "INVALID_EXPENSE_AMOUNT",
    status: 400,
    message: "금액을 확인해 주세요",
  });
});

const categories = [
  "FLIGHT",
  "ACCOMMODATION",
  "FOOD",
  "TRANSPORT",
  "SHOPPING",
  "SIGHTSEEING",
  "OTHER",
] as const;
it.each(categories)(
  "transports category %s through create/list/edit/delete without rewriting it",
  async (category) => {
    const body = {
      expenseGroup: "PREPARATION" as const,
      scheduleId: null,
      scheduleItemId: null,
      totalAmount: "1.01",
      currency: "USD",
      category,
      memo: null,
      payerUserIds: [1],
      participantUserIds: [1],
    };
    const expense = {
      ...body,
      id: 10,
      createdAt: "2026-09-09T12:00:00Z",
      updatedAt: "2026-09-09T12:00:00Z",
    };
    fetcher.mockResolvedValueOnce(
      new Response(JSON.stringify(expense), { status: 201 }),
    );
    expect(await createExpense("r", body)).toEqual(expense);
    expect(fetcher.mock.lastCall?.[1].method).toBe("POST");
    expect(JSON.parse(fetcher.mock.lastCall?.[1].body)).toEqual(body);
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify([expense])));
    expect(await getExpenses("r")).toEqual([expense]);
    const replacement = category === "OTHER" ? "FLIGHT" : "OTHER";
    fetcher.mockResolvedValueOnce(
      new Response(JSON.stringify({ ...expense, category: replacement })),
    );
    expect(
      (await patchExpense("r", 10, { category: replacement })).category,
    ).toBe(replacement);
    expect(fetcher.mock.lastCall?.[1].method).toBe("PATCH");
    expect(JSON.parse(fetcher.mock.lastCall?.[1].body)).toEqual({
      category: replacement,
    });
    fetcher.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(deleteExpense("r", 10)).resolves.toBeUndefined();
    expect(fetcher.mock.lastCall?.[0]).toBe(
      "http://fixture/rooms/r/expenses/10",
    );
    expect(fetcher.mock.lastCall?.[1].method).toBe("DELETE");
  },
);
it("preserves ordered server category totals and BAD_REQUEST category errors", async () => {
  const summary = {
    currencies: [
      {
        currency: "KRW",
        totalAmount: "28",
        individuals: [],
        transfers: [],
        days: [],
        categories: categories.map((category, i) => ({
          category,
          totalAmount: String(i + 1),
        })),
      },
    ],
  };
  fetcher.mockResolvedValueOnce(new Response(JSON.stringify(summary)));
  expect(await getExpenseSummary("r")).toEqual(summary);
  fetcher.mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        code: "BAD_REQUEST",
        message: "입력 항목을 확인해 주세요.",
      }),
      { status: 400 },
    ),
  );
  await expect(
    patchExpense("r", 10, { category: "FLIGHT" }),
  ).rejects.toMatchObject({ status: 400, code: "BAD_REQUEST" });
});
