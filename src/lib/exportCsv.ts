/**
 * CSV export helpers — RFC 4180 quoting with UTF-8 BOM so Excel renders Thai
 * text correctly when the file is double-clicked open.
 */

/** Quote/escape a single CSV field per RFC 4180. */
export function escapeCsvField(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Build a CSV string from a list of objects + ordered header keys. */
export function buildCsv(
  rows: Record<string, unknown>[],
  headers: string[]
): string {
  const headerLine = headers.map(escapeCsvField).join(",");
  const dataLines = rows.map((row) =>
    headers.map((h) => escapeCsvField(row[h])).join(",")
  );
  // BOM (﻿) makes Excel detect UTF-8 → Thai characters render correctly.
  // CRLF line endings match Excel's expectations on Windows.
  return "﻿" + [headerLine, ...dataLines].join("\r\n");
}

/** Trigger a browser download of `csvText` as a file named `filename`. */
export function downloadCsv(csvText: string, filename: string): void {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
