// Someone can work at two businesses. Clocking in at one must only look at
// that business's shifts for the day — never the other business's.
type Row = Record<string, unknown>;
const shifts: Row[] = [
  { id: 1, staff_id: 7, shift_date: "2026-10-05", start_time: "09:00:00", end_time: "13:00:00", status: "scheduled", business_id: 1 },
  { id: 2, staff_id: 7, shift_date: "2026-10-05", start_time: "17:00:00", end_time: "22:00:00", status: "scheduled", business_id: 2 },
];

jest.mock("../supabase", () => {
  const from = (table: string) => {
    let rows = table === "shifts" ? [...shifts] : [];
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: (c: string, v: unknown) => { rows = rows.filter((r) => r[c] === v); return chain; },
      neq: (c: string, v: unknown) => { rows = rows.filter((r) => r[c] !== v); return chain; },
      order: () => chain,
      then: (res: (v: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(res),
    };
    return chain;
  };
  return { __esModule: true, default: { from } };
});

import { scheduleSlotsFor } from "../rota";

const settings = { timezone: "Europe/London" } as Parameters<typeof scheduleSlotsFor>[4];
const rota = { rota_start: null, rota_end: null } as unknown as Parameters<typeof scheduleSlotsFor>[3];

it("only uses the shifts of the business being clocked into", async () => {
  const atRoyalChilli = await scheduleSlotsFor(1, 7, "2026-10-05", rota, settings);
  const atMeltHouse = await scheduleSlotsFor(2, 7, "2026-10-05", rota, settings);
  expect(atRoyalChilli.map((s) => s.shiftId)).toEqual([1]);
  expect(atMeltHouse.map((s) => s.shiftId)).toEqual([2]);
});
