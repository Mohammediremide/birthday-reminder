import * as XLSX from "xlsx";

// Maps the 3-letter month abbreviations used in the "Date of Birth" column
// (e.g. "01-Dec") to a month number. We parse manually instead of trusting
// `new Date("01-Dec")` because that's ambiguous/locale-dependent in JS.
const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * Parses a "DD-Mon" string like "01-Dec" or "5-Jul" into { day, month }.
 * Returns null if the text doesn't match the expected shape.
 */
function parseDob(text) {
  if (!text) return null;
  const match = String(text).trim().match(/^(\d{1,2})-([A-Za-z]{3})$/);
  if (!match) return null;

  const day = parseInt(match[1], 10);
  const month = MONTHS[match[2].toLowerCase()];
  if (!month || day < 1 || day > 31) return null;

  return { day, month };
}

/**
 * Reads the uploaded workbook (as an ArrayBuffer) and returns an array of
 * people: { cohort, fullName, email, dob: {day, month}, whatsapp, country }
 *
 * Assumes the same layout as the "Excel With Dikky" community database:
 * header row 4, data starting row 5, columns A-Q as documented in the sheet.
 */
export function parsePeopleFromWorkbook(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  // header: false gives us raw rows (arrays) so we can skip straight to row 5
  // (index 4) regardless of the decorative header rows above it.
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  const people = [];

  for (let i = 4; i < rows.length; i++) {
    const row = rows[i];
    const cohort = row[0];
    const email = row[1];
    const fullName = row[5];
    const dobText = row[6];
    const whatsapp = row[11];
    const country = row[12];

    const dob = parseDob(dobText);
    if (!dob || !fullName) continue; // skip blank/trailing rows

    people.push({ cohort, fullName, email, dob, whatsapp, country });
  }

  return people;
}

/** Splits a people list into today's and tomorrow's birthdays. */
export function findBirthdays(people, referenceDate = new Date()) {
  const today = referenceDate;
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const isMatch = (dob, date) =>
    dob.month === date.getMonth() + 1 && dob.day === date.getDate();

  return {
    today: people.filter((p) => isMatch(p.dob, today)),
    tomorrow: people.filter((p) => isMatch(p.dob, tomorrow)),
  };
}
