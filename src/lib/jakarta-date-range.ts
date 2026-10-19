const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1_000;

type DateOnlyParts = { year: number; month: number; day: number };

function parseDateOnly(value: string): DateOnlyParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;

  return { year, month, day };
}

function startOfJakartaDay({ year, month, day }: DateOnlyParts) {
  return new Date(Date.UTC(year, month - 1, day) - JAKARTA_OFFSET_MS);
}

/** Returns an inclusive-start/exclusive-end calendar-month range in WIB. */
export function getJakartaMonthRange(year: number, month: number) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;

  return {
    start: startOfJakartaDay({ year, month, day: 1 }),
    end: new Date(Date.UTC(year, month, 1) - JAKARTA_OFFSET_MS),
  };
}

/** Returns an inclusive-start/exclusive-end date range in WIB. */
export function getJakartaDateRange(startDate?: string | null, endDate?: string | null) {
  const startParts = startDate ? parseDateOnly(startDate) : null;
  const endParts = endDate ? parseDateOnly(endDate) : null;

  return {
    start: startParts ? startOfJakartaDay(startParts) : undefined,
    end: endParts
      ? new Date(Date.UTC(endParts.year, endParts.month - 1, endParts.day + 1) - JAKARTA_OFFSET_MS)
      : undefined,
  };
}
