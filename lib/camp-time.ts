/**
 * Camp time handling.
 *
 * The rule, which applies everywhere in this application:
 *
 *   Camp times are wall-clock times IN THE CAMP'S TIMEZONE. They are stored as absolute
 *   instants and rendered back in the camp timezone — never the viewer's device
 *   timezone (FR-SCHED-09, FR-2X2-10).
 *
 * The legacy app got this wrong in both directions (L-07): it stored free text such as
 * "7:30pm", parsed it in the browser with a regex, and built a Date in the DEVICE's
 * timezone. A camper whose phone was set to another region saw the wrong schedule, and
 * scheduling a reminder off a string like that was impossible (FR-PUSH-06).
 */

/**
 * Offset in minutes between UTC and `timeZone` at a given instant.
 *
 * Derived by formatting the instant in the target zone and comparing with UTC, which
 * handles DST without a timezone database. India has no DST, but this must stay correct
 * if the camp timezone ever changes.
 */
function offsetMinutes(instant: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(instant).map((p) => [p.type, p.value]),
  ) as Record<string, string>;

  // Intl renders midnight as hour 24 in some environments.
  const hour = parts.hour === '24' ? '00' : parts.hour;

  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(hour),
    Number(parts.minute),
    Number(parts.second),
  );

  return (asUtc - instant.getTime()) / 60_000;
}

/**
 * Convert a wall-clock date and time in `timeZone` into an absolute instant.
 *
 * @param date ISO calendar date, `YYYY-MM-DD`
 * @param time 24-hour clock time, `HH:mm`
 *
 * Two passes are needed because the offset itself depends on the instant: guess using
 * the offset at the naive UTC interpretation, then correct using the offset actually in
 * force at that guess. This resolves DST transitions correctly.
 */
export function campTimeToInstant(date: string, time: string, timeZone: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute)
  ) {
    throw new Error(`Invalid camp time: date=${date!} time=${time!}`);
  }

  const naive = Date.UTC(year!, month! - 1, day!, hour!, minute!);
  const guess = new Date(naive - offsetMinutes(new Date(naive), timeZone) * 60_000);
  const corrected = new Date(naive - offsetMinutes(guess, timeZone) * 60_000);

  return corrected;
}

/** Start of a calendar day (00:00) in the camp timezone, as an absolute instant. */
export function campDayStart(date: string, timeZone: string): Date {
  return campTimeToInstant(date, '00:00', timeZone);
}

/**
 * Parse a legacy free-text time such as "7:30pm", "12:00am", "9:15 AM" into `HH:mm`.
 *
 * Used only by the legacy import (DATA-MIG-01). New data never travels as a string.
 *
 * Returns null when the value cannot be parsed with confidence. Callers MUST treat null
 * as a hard failure and report it (DATA-MIG-03) — never default to midnight, and never
 * skip the row. A silently wrong schedule is worse than a failed import.
 *
 * The 12-hour clock's edge cases are the classic trap here:
 *   12:00am -> 00:00  (midnight)
 *   12:00pm -> 12:00  (noon)
 *   12:30am -> 00:30
 */
export function parseLegacyTime(raw: string): string | null {
  if (typeof raw !== 'string') return null;

  const value = raw.trim().toLowerCase().replace(/\s+/g, '');
  if (!value) return null;

  // Accept "7:30pm", "7.30pm", "730pm", "7pm", and 24-hour "19:30".
  const match = value.match(/^(\d{1,2})(?:[:.]?(\d{2}))?(am|pm)?$/);
  if (!match) return null;

  const [, rawHour, rawMinute, meridiem] = match;

  let hour = Number(rawHour);
  const minute = rawMinute === undefined ? 0 : Number(rawMinute);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (minute > 59) return null;

  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (meridiem === 'am') {
      // 12am is midnight -> 0. Every other am hour is unchanged.
      hour = hour === 12 ? 0 : hour;
    } else {
      // 12pm is noon -> 12. Every other pm hour shifts by 12.
      hour = hour === 12 ? 12 : hour + 12;
    }
  } else if (hour > 23) {
    return null;
  }

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * Parse a legacy `dd/MM/yyyy` date into ISO `YYYY-MM-DD`.
 *
 * Day-first, matching the legacy frontend which split on "/" and read [0] as the day.
 * Returns null on anything unparseable (DATA-MIG-03).
 */
export function parseLegacyDate(raw: string): string | null {
  if (typeof raw !== 'string') return null;

  const match = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  // Reject impossible dates such as 31/02/2026.
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Format an instant as a camp-local time, e.g. "7:30 pm" (FR-SCHED-07). */
export function formatCampTime(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(instant);
}

/** Format an instant as a camp-local date, e.g. "24 May". */
export function formatCampDate(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    day: 'numeric',
    month: 'short',
  }).format(instant);
}

/** The calendar date (`YYYY-MM-DD`) an instant falls on, in the camp timezone. */
export function campDateOf(instant: Date, timeZone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;

  return `${parts.year}-${parts.month}-${parts.day}`;
}
