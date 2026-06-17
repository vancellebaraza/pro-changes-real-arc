import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export interface QuoteItem {
  description: string;
  qty: number;
  unit_cost: number;
  amount: number;
}

export interface QuotePdfInput {
  projectTitle: string;
  service: string;
  location?: string | null;
  clientName?: string;
  engineerName?: string;
  quoteId: string;
  date: string;
  items: QuoteItem[];
  vatRate: number;
  subtotal: number;
  vatAmount: number;
  grandTotal: number;
  notes?: string | null;
}

export function generateQuotationPdf(q: QuotePdfInput) {
  const doc = new jsPDF();
  doc.setFontSize(20);
  doc.setTextColor(218, 31, 38);
  doc.text("FUSIONPRO", 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.text("RealArc Estates — Quotation", 14, 24);

  doc.setTextColor(20);
  doc.setFontSize(11);
  doc.text(`Quotation #: ${q.quoteId.slice(0, 8).toUpperCase()}`, 140, 18);
  doc.text(`Date: ${q.date}`, 140, 24);

  doc.setFontSize(12);
  doc.text(q.projectTitle, 14, 38);
  doc.setFontSize(9);
  doc.setTextColor(100);
  const meta = [
    `Service: ${q.service}`,
    q.location ? `Location: ${q.location}` : "",
    q.clientName ? `Client: ${q.clientName}` : "",
    q.engineerName ? `Engineer: ${q.engineerName}` : "",
  ].filter(Boolean);
  doc.text(meta.join("   |   "), 14, 44);

  autoTable(doc, {
    startY: 52,
    head: [["Description", "Qty", "Unit Cost", "Amount"]],
    body: q.items.map((i) => [
      i.description,
      String(i.qty),
      i.unit_cost.toFixed(2),
      i.amount.toFixed(2),
    ]),
    styles: { fontSize: 10 },
    headStyles: { fillColor: [30, 30, 30] },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
  });

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  doc.setFontSize(10);
  doc.setTextColor(20);
  doc.text(`Subtotal: ${q.subtotal.toFixed(2)}`, 150, finalY, { align: "left" });
  doc.text(`VAT (${q.vatRate}%): ${q.vatAmount.toFixed(2)}`, 150, finalY + 6, { align: "left" });
  doc.setFontSize(12);
  doc.text(`Grand Total: ${q.grandTotal.toFixed(2)}`, 150, finalY + 14, { align: "left" });

  if (q.notes) {
    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.text("Notes:", 14, finalY + 24);
    doc.text(doc.splitTextToSize(q.notes, 180), 14, finalY + 30);
  }

  doc.save(`Quotation-${q.quoteId.slice(0, 8)}.pdf`);
}

export function generateInspectionPdf(input: {
  projectTitle: string;
  date: string;
  stage: string;
  checklist: Array<{ item: string; pass: boolean; remark?: string }>;
  remarks?: string | null;
}) {
  const doc = new jsPDF();
  doc.setFontSize(20);
  doc.setTextColor(218, 31, 38);
  doc.text("FUSIONPRO", 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.text("Inspection Report", 14, 24);
  doc.setTextColor(20);
  doc.setFontSize(12);
  doc.text(input.projectTitle, 14, 38);
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Stage: ${input.stage}   |   Date: ${input.date}`, 14, 44);

  autoTable(doc, {
    startY: 52,
    head: [["Item", "Result", "Remark"]],
    body: input.checklist.map((c) => [c.item, c.pass ? "PASS" : "FAIL", c.remark ?? ""]),
    styles: { fontSize: 10 },
    headStyles: { fillColor: [30, 30, 30] },
  });
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  if (input.remarks) {
    doc.setFontSize(10);
    doc.text("General remarks:", 14, finalY);
    doc.text(doc.splitTextToSize(input.remarks, 180), 14, finalY + 6);
  }
  doc.save(`Inspection-${Date.now()}.pdf`);
}

export function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
