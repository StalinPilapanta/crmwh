/**
 * Parses CSV content (from Google Sheets export) into structured text
 * suitable for AI knowledge base indexing.
 */
export function parseSheetsCSV(csv: string, sheetName?: string): string {
  const lines = csv.split("\n").filter((line) => line.trim().length > 0);

  if (lines.length === 0) return "";

  // First line is headers
  const headers = parseCSVLine(lines[0]);
  const rows = lines.slice(1).map((line) => parseCSVLine(line));

  // Convert to readable text format
  let text = sheetName ? `## ${sheetName}\n\n` : "";

  for (const row of rows) {
    const entries = headers
      .map((header, i) => {
        const value = row[i]?.trim();
        if (!value) return null;
        return `${header}: ${value}`;
      })
      .filter(Boolean);

    if (entries.length > 0) {
      text += entries.join(" | ") + "\n";
    }
  }

  return text;
}

/**
 * Simple CSV line parser that handles quoted fields.
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  fields.push(current.trim());
  return fields;
}

/**
 * Parses a Google Docs plain text export for knowledge base.
 */
export function parseDocText(text: string, docName?: string): string {
  if (!text.trim()) return "";
  return docName ? `## ${docName}\n\n${text}` : text;
}
