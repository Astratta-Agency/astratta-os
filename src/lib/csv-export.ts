export type CsvColumn<T = any> = {
  key: string;
  header: string;
  format?: (v: any, row: T) => string;
};

function escapeCell(value: any): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function exportToCsv<T extends Record<string, any>>(
  filename: string,
  rows: T[],
  columns: CsvColumn<T>[],
): void {
  if (!rows.length) {
    console.warn("[exportToCsv] no rows to export");
    return;
  }
  const headerLine = columns.map((c) => escapeCell(c.header)).join(",");
  const lines = rows.map((row) =>
    columns
      .map((c) => {
        const raw = row[c.key];
        const val = c.format ? c.format(raw, row) : raw;
        return escapeCell(val);
      })
      .join(","),
  );
  const csv = "\uFEFF" + [headerLine, ...lines].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = sanitizeFilename(filename);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
