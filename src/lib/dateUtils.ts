const TH_OFFSET_MS = 7 * 60 * 60 * 1000; // GMT+7

/** Start of today in Thai timezone (returns UTC Date) */
export function startOfDayTH(): Date {
  const now = new Date();
  const thNow = new Date(now.getTime() + TH_OFFSET_MS);
  thNow.setUTCHours(0, 0, 0, 0);
  return new Date(thNow.getTime() - TH_OFFSET_MS);
}

/** End of today (start of tomorrow) in Thai timezone (returns UTC Date) */
export function endOfDayTH(): Date {
  const start = startOfDayTH();
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}
