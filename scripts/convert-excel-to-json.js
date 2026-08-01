/**
 * Run this any time your Excel roster changes:
 *   node scripts/convert-excel-to-json.js "path/to/Excel_With_Dikky_-_Community_Database.xlsx"
 *
 * It writes data/roster.json, which is what the deployed app actually reads
 * from (Vercel's serverless functions can't reach your local Excel file, so
 * this JSON snapshot is what ships with each deploy). After running this,
 * commit + push to redeploy with the updated roster.
 */
import * as XLSX from "xlsx";
import fs from "fs";
import path from "path";

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function parseDob(text) {
  if (!text) return null;
  const match = String(text).trim().match(/^(\d{1,2})-([A-Za-z]{3})$/);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const month = MONTHS[match[2].toLowerCase()];
  if (!month || day < 1 || day > 31) return null;
  return { day, month };
}

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: node scripts/convert-excel-to-json.js <path-to-excel-file>");
  process.exit(1);
}

const buffer = fs.readFileSync(filePath);
const workbook = XLSX.read(buffer, { type: "buffer" });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
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
  if (!dob || !fullName) continue;

  people.push({ cohort, fullName, email, dob, whatsapp, country });
}

const outPath = path.join(process.cwd(), "data", "roster.json");
fs.writeFileSync(outPath, JSON.stringify(people, null, 2));
console.log(`Wrote ${people.length} people to ${outPath}`);
