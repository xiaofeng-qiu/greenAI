/** Returns true if `tz` is accepted by the runtime as an IANA time zone name. */
export function isValidIanaTimeZone(tz: string): boolean {
  if (tz.length < 2 || tz.length > 64) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
