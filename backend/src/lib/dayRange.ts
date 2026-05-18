import { addDays, startOfDay } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

/** Inclusive start, exclusive end in UTC for the user's current local calendar day. */
export function utcRangeForUserLocalToday(
  now: Date,
  timeZone: string
): { start: Date; end: Date } {
  const zonedNow = toZonedTime(now, timeZone);
  const startLocal = startOfDay(zonedNow);
  const endLocal = addDays(startLocal, 1);
  return {
    start: fromZonedTime(startLocal, timeZone),
    end: fromZonedTime(endLocal, timeZone),
  };
}
