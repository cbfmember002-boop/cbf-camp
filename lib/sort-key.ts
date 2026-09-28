/**
 * Room sort keys (DATA-ROOM-02).
 *
 * Ordering room descriptions as plain text puts "A10" before "A9", because "1" sorts
 * before "9". Every numeric run is therefore zero-padded to a fixed width on write, so
 * the database can ORDER BY a single indexed column instead of parsing at query time.
 *
 *   "A9"        -> "a|000000009"
 *   "A10"       -> "a|000000010"
 *   "Dorm 2B"   -> "dorm |000000002|b"
 *
 * Padding to 9 digits comfortably exceeds any realistic room number.
 */
const PAD_WIDTH = 9;

export function roomSortKey(description: string): string {
  return description
    .trim()
    .toLowerCase()
    .replace(/(\d+)/g, (digits) => `|${digits.padStart(PAD_WIDTH, '0')}|`)
    .replace(/\|\|/g, '|')
    .replace(/\|$/, '');
}
