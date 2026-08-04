import { csvRows, downloadCsv } from "./csv";

export type ReportSection = {
  heading?: string;
  meta?: [string, string][];
  head?: string[];
  body?: unknown[][];
};

export type ReportDoc = {
  title: string;
  meta?: [string, string][];
  sections: ReportSection[];
};

export type ExportFormat = "csv" | "pdf";

export function isEmptyDoc(doc: ReportDoc): boolean {
  return doc.sections.every((s) => !(s.body && s.body.length));
}

export function docToCsvRows(doc: ReportDoc): unknown[][] {
  const rows: unknown[][] = [[doc.title]];
  for (const [k, v] of doc.meta ?? []) rows.push([k, v]);
  rows.push([]);
  for (const s of doc.sections) {
    if (s.heading) rows.push([s.heading]);
    for (const [k, v] of s.meta ?? []) rows.push([k, v]);
    if (s.head) rows.push(s.head);
    for (const r of s.body ?? []) rows.push(r);
    rows.push([]);
  }
  return rows;
}

export async function downloadReport(baseName: string, format: ExportFormat, doc: ReportDoc) {
  if (format === "csv") {
    downloadCsv(`${baseName}.csv`, csvRows(docToCsvRows(doc)));
    return;
  }

  const [{ jsPDF }, autoTableMod] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = autoTableMod.default;

  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 40;
  let y = margin;

  pdf.setFontSize(16);
  pdf.setTextColor(30, 27, 75);
  pdf.text(doc.title, margin, y);
  y += 18;

  pdf.setFontSize(9);
  pdf.setTextColor(110);
  for (const [k, v] of doc.meta ?? []) {
    pdf.text(`${k}: ${v}`, margin, y);
    y += 12;
  }
  y += 6;

  for (const s of doc.sections) {
    if (s.heading) {
      pdf.setFontSize(11);
      pdf.setTextColor(30, 27, 75);
      pdf.text(s.heading, margin, y);
      y += 14;
    }
    if (s.meta?.length) {
      pdf.setFontSize(9);
      pdf.setTextColor(110);
      for (const [k, v] of s.meta) {
        pdf.text(`${k}: ${v}`, margin, y);
        y += 12;
      }
      y += 2;
    }
    if (s.head && s.body?.length) {
      autoTable(pdf, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [s.head],
        body: s.body.map((r) => r.map((c) => (c === null || c === undefined ? "" : String(c)))),
        styles: { fontSize: 8, cellPadding: 4, textColor: [40, 40, 55] },
        headStyles: { fillColor: [99, 71, 235], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [244, 243, 255] },
      });
      y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;
    }
    if (y > pdf.internal.pageSize.getHeight() - 80) {
      pdf.addPage();
      y = margin;
    }
  }

  pdf.save(`${baseName}.pdf`);
}
