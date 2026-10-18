// UK calendar dates for the pages. toISOString() is UTC, so during British
// Summer Time a date worked out between midnight and 1am UK time landed on
// the day before — at 00:19 on Monday 19 Oct the rota showed the week as
// starting "Mon 18" (a Sunday). Everything here is "YYYY-MM-DD" in UK time,
// and the arithmetic is done on plain dates so no clock can shift it.
// Safe to import in the browser.

/** Today's date in the UK, "YYYY-MM-DD". */
export function ukToday(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** The Monday of the week `iso` falls in (weeks run Monday–Sunday). */
export function mondayOf(iso: string): string {
  const day = new Date(iso + "T12:00:00Z").getUTCDay(); // 0 = Sunday
  return addDays(iso, -((day + 6) % 7));
}

/** This week's Monday in the UK. */
export function ukMonday(now: Date = new Date()): string {
  return mondayOf(ukToday(now));
}

/** [first, last] day of the month `iso` falls in, moved by `months`. */
export function monthRange(iso: string, months = 0): [string, string] {
  const [y, m] = iso.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
  return [first.toISOString().slice(0, 10), last.toISOString().slice(0, 10)];
}
