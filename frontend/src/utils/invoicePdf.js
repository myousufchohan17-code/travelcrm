import { formatDate, money } from "../api/client";

function value(invoice, camel, snake = camel) {
  return invoice?.[camel] ?? invoice?.[snake] ?? "";
}

function itemsOf(invoice) {
  if (Array.isArray(invoice?.items)) return invoice.items;
  if (typeof invoice?.items === "string") {
    try { return JSON.parse(invoice.items); } catch { return []; }
  }
  return [];
}

export async function downloadInvoicePdf(invoice, settings = {}) {
  const [{ jsPDF }, { default: autoTable }, { default: QRCode }] = await Promise.all([import("jspdf"), import("jspdf-autotable"), import("qrcode")]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const company = settings.company_name || "Travel Agency";
  const items = itemsOf(invoice);
  const blue = [29, 78, 216];

  doc.setFillColor(...blue);
  doc.rect(0, 0, 210, 40, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.text(company, 16, 18, { maxWidth: 112 });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("TRAVEL SERVICES", 16, 27);
  const agencyContact = [settings.contact_email, settings.contact_phone].filter(Boolean).join("  |  ");
  if (agencyContact) {
    doc.setFontSize(7);
    doc.text(agencyContact, 16, 34, { maxWidth: 118 });
  }
  doc.setFontSize(17);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE", 194, 18, { align: "right" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(String(invoice.invoice_number || ""), 194, 27, { align: "right" });

  doc.setTextColor(35, 48, 69);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("BILL TO", 16, 53);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(String(invoice.client_name || "Client"), 16, 60);
  doc.setFontSize(9);
  const clientContact = [invoice.client_email, invoice.client_phone, invoice.client_address].filter(Boolean).map(String);
  clientContact.forEach((line, index) => doc.text(line, 16, 66 + index * 5, { maxWidth: 88 }));

  doc.setFont("helvetica", "bold");
  doc.text("INVOICE DETAILS", 126, 53);
  doc.setFont("helvetica", "normal");
  doc.text(`Issue date: ${formatDate(value(invoice, "issue_date"))}`, 126, 60);
  doc.text(`Due date: ${formatDate(value(invoice, "due_date"))}`, 126, 66);
  doc.text(`Status: ${String(invoice.status || "pending").toUpperCase()}`, 126, 72);
  doc.text(`Payment: ${invoice.payment_method || "Not recorded"}`, 126, 78);

  const trip = [invoice.booking_label, invoice.destination, invoice.travel_start_date || invoice.travel_end_date
    ? `${formatDate(invoice.travel_start_date)} - ${formatDate(invoice.travel_end_date)}` : ""].filter(Boolean);
  let sectionY = 88;
  if (trip.length) {
    doc.setDrawColor(225, 232, 242);
    doc.line(16, 84, 194, 84);
    doc.setFont("helvetica", "bold");
    doc.text("TRIP", 16, sectionY);
    doc.setFont("helvetica", "normal");
    doc.text(trip.join("  |  "), 16, sectionY + 6, { maxWidth: 178 });
    sectionY += 18;
  }

  autoTable(doc, {
    startY: sectionY,
    head: [["Service / item", "Qty", "Unit price", "Amount"]],
    body: items.map((item) => [
      item.description || "Travel service",
      String(item.quantity ?? 1),
      money(item.unitPrice ?? item.unit_price ?? 0),
      money(item.total ?? (Number(item.quantity || 1) * Number(item.unitPrice ?? item.unit_price ?? 0))),
    ]),
    theme: "grid",
    headStyles: { fillColor: blue, textColor: 255, fontStyle: "bold" },
    bodyStyles: { textColor: [55, 65, 81], lineColor: [230, 235, 243], fontSize: 9, cellPadding: 3 },
    columnStyles: { 0: { cellWidth: 92 }, 1: { halign: "right", cellWidth: 18 }, 2: { halign: "right", cellWidth: 33 }, 3: { halign: "right", cellWidth: 35 } },
    margin: { left: 16, right: 16 },
  });

  let y = doc.lastAutoTable.finalY + 9;
  if (y > 235) {
    doc.addPage();
    y = 22;
  }
  const totals = [
    ["Subtotal", money(invoice.subtotal)],
    ...(Number(invoice.discount) ? [["Discount", `- ${money(invoice.discount)}`]] : []),
    ...(Number(invoice.tax) ? [["Tax", money(invoice.tax)]] : []),
  ];
  doc.setFontSize(9);
  doc.setTextColor(85, 96, 113);
  totals.forEach(([label, amount]) => {
    doc.text(label, 137, y);
    doc.text(amount, 194, y, { align: "right" });
    y += 6;
  });
  doc.setDrawColor(...blue);
  doc.line(134, y - 2, 194, y - 2);
  doc.setTextColor(29, 78, 216);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("TOTAL", 137, y + 5);
  doc.text(money(invoice.total), 194, y + 5, { align: "right" });
  y += 14;
  doc.setTextColor(55, 65, 81);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Paid: ${money(invoice.amount_paid || 0)}`, 137, y);
  doc.text(`Balance: ${money(invoice.remaining_balance ?? Number(invoice.total) - Number(invoice.amount_paid || 0))}`, 194, y, { align: "right" });
  const qr = await QRCode.toDataURL(`Invoice reference: ${invoice.invoice_number}\nTotal: ${invoice.total}`, { width: 128, margin: 1, color: { dark: "#1d4ed8", light: "#ffffff" } });
  doc.addImage(qr, "PNG", 16, y - 8, 20, 20);
  doc.setFontSize(8);
  doc.text("Payment reference QR", 40, y - 1);
  doc.setFontSize(9);
  y += 12;

  const notes = invoice.notes || "Please contact your travel consultant with any questions about this invoice.";
  const blocks = [
    ["PAYMENT REFERENCE", invoice.invoice_number],
    ["NOTES & TERMS", notes],
  ];
  for (const [title, body] of blocks) {
    if (y > 260) {
      doc.addPage();
      y = 22;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(85, 96, 113);
    doc.text(title, 16, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(55, 65, 81);
    const lines = doc.splitTextToSize(String(body), 178);
    doc.text(lines, 16, y + 6);
    y += 10 + lines.length * 4;
  }
  if (y > 280) {
    doc.addPage();
    y = 22;
  }
  doc.setDrawColor(225, 232, 242);
  doc.line(16, y, 194, y);
  doc.setTextColor(29, 78, 216);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Thank you for travelling with us.", 105, y + 9, { align: "center" });
  doc.save(`${invoice.invoice_number || "invoice"}.pdf`);
}

function escapeHtml(input) {
  return String(input ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

export function printInvoice(invoice, settings = {}) {
  const printWindow = window.open("", "_blank", "width=900,height=720");
  if (!printWindow) return false;
  printWindow.opener = null;
  const company = escapeHtml(settings.company_name || "Travel Agency");
  const agencyContact = [settings.contact_email, settings.contact_phone].filter(Boolean).map(escapeHtml).join(" · ");
  const rows = itemsOf(invoice).map((item) => `<tr><td>${escapeHtml(item.description)}</td><td>${escapeHtml(item.quantity ?? 1)}</td><td>${money(item.unitPrice ?? item.unit_price ?? 0)}</td><td>${money(item.total ?? Number(item.quantity || 1) * Number(item.unitPrice ?? item.unit_price ?? 0))}</td></tr>`).join("");
  printWindow.document.write(`<!doctype html><html><head><title>${escapeHtml(invoice.invoice_number)}</title><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{margin:0;padding:44px;font:14px/1.5 Arial,sans-serif;color:#243047}header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:4px solid #1d4ed8;padding-bottom:22px}h1{margin:0;color:#1d4ed8;font-size:22px}h2{margin:0;font-size:26px}small,.muted{color:#64748b}.grid{display:grid;grid-template-columns:1fr 1fr;gap:36px;margin:28px 0}strong{display:block;margin-bottom:7px}table{width:100%;border-collapse:collapse;margin:30px 0}th{background:#1d4ed8;color:white;text-align:left}th,td{padding:11px;border-bottom:1px solid #e2e8f0}td:nth-child(n+2),th:nth-child(n+2){text-align:right}.totals{width:290px;margin-left:auto}.totals div{display:flex;justify-content:space-between;padding:5px 0}.grand{border-top:2px solid #1d4ed8;color:#1d4ed8;font-size:18px;font-weight:bold;margin-top:6px;padding-top:10px!important}.terms{margin-top:26px;padding-top:16px;border-top:1px solid #e2e8f0}.thanks{text-align:center;color:#1d4ed8;font-weight:bold;margin-top:28px}@media print{body{padding:18mm}@page{size:A4;margin:0}}
    </style></head><body><header><div><h1>${company}</h1><small>TRAVEL SERVICES</small>${agencyContact ? `<div class="muted">${agencyContact}</div>` : ""}</div><div style="text-align:right"><h2>INVOICE</h2><strong>${escapeHtml(invoice.invoice_number)}</strong><small>${escapeHtml(String(invoice.status || "pending").toUpperCase())}</small></div></header>
    <div class="grid"><div><strong>BILL TO</strong>${escapeHtml(invoice.client_name)}<br>${escapeHtml(invoice.client_email)}<br>${escapeHtml(invoice.client_phone)}<br>${escapeHtml(invoice.client_address)}</div><div><strong>INVOICE DETAILS</strong>Issued: ${formatDate(value(invoice, "issue_date"))}<br>Due: ${formatDate(value(invoice, "due_date"))}<br>Destination: ${escapeHtml(invoice.destination)}<br>Travel: ${formatDate(invoice.travel_start_date)} - ${formatDate(invoice.travel_end_date)}<br>Payment method: ${escapeHtml(invoice.payment_method || "Not recorded")}</div></div>
    <p><strong>Booking / trip</strong>${escapeHtml(invoice.booking_label || "—")}</p><table><thead><tr><th>Service / item</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="totals"><div><span>Subtotal</span><span>${money(invoice.subtotal)}</span></div>${Number(invoice.discount) ? `<div><span>Discount</span><span>- ${money(invoice.discount)}</span></div>` : ""}${Number(invoice.tax) ? `<div><span>Tax</span><span>${money(invoice.tax)}</span></div>` : ""}<div class="grand"><span>Total</span><span>${money(invoice.total)}</span></div><div><span>Paid</span><span>${money(invoice.amount_paid || 0)}</span></div><div><span>Remaining</span><span>${money(invoice.remaining_balance ?? Number(invoice.total) - Number(invoice.amount_paid || 0))}</span></div></div>
    <div class="terms"><strong>PAYMENT REFERENCE</strong>${escapeHtml(invoice.invoice_number)}<p><strong>NOTES & TERMS</strong>${escapeHtml(invoice.notes || "Please contact your travel consultant with any questions about this invoice.")}</p></div><p class="thanks">Thank you for travelling with us.</p><script>window.onload=()=>window.print();</script></body></html>`);
  printWindow.document.close();
  return true;
}