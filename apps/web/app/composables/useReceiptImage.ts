/**
 * Receipt composable — WhatsApp text + downloadable image.
 *
 * Two separate actions (not a fallback chain):
 * 1. sendReceiptWhatsApp() — opens WhatsApp with formatted text (always works)
 * 2. downloadReceiptImage() — generates PNG via Canvas and downloads it
 *
 * Why not Web Share API?
 * - Inconsistent across browsers (fails silently on many)
 * - Requires user gesture context (breaks in async flows)
 * - File sharing not supported on Firefox, older Chrome
 * - window.location.href to wa.me navigates away from the app
 *
 * The text-based WhatsApp approach works on 100% of devices because
 * it just opens a URL. The image download is a separate explicit action.
 */

export interface ReceiptData {
  businessName: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  subtotal: number;
  surcharges?: Array<{ name: string; amount: number }>;
  totalUsd: number;
  totalBs?: number;
  exchangeRate?: number;
  paymentMethod: string;
  date: Date;
}

/**
 * Send receipt as formatted text via WhatsApp.
 *
 * Opens WhatsApp in a new tab/window. Uses window.open (not location.href)
 * so the user stays in Nova. If popup is blocked, returns false.
 *
 * @param data - Receipt content
 * @param phone - Optional phone number to send directly to a contact
 * @returns true if WhatsApp was opened, false if blocked
 */
export function sendReceiptWhatsApp(
  data: ReceiptData,
  phone?: string | null,
): boolean {
  if (!import.meta.client) return false;

  const text = buildReceiptText(data);
  const encoded = encodeURIComponent(text);
  const cleanPhone = phone?.replace(/[^0-9]/g, "") ?? "";

  // wa.me/{phone} for direct contact, api.whatsapp.com/send for contact picker
  const url = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encoded}`
    : `https://api.whatsapp.com/send?text=${encoded}`;

  const win = window.open(url, "_blank", "noopener,noreferrer");
  return win !== null;
}

/**
 * Generate and download a receipt as PNG image.
 *
 * Creates the image via Canvas API and triggers a browser download.
 * The image is NOT stored anywhere — it's generated on demand and
 * downloaded directly to the user's device.
 *
 * @param data - Receipt content
 * @returns true if download was triggered, false if Canvas failed
 */
export function downloadReceiptImage(data: ReceiptData): boolean {
  if (!import.meta.client) return false;

  const blob = generateReceiptImage(data);
  if (!blob) return false;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `recibo-${data.date.getTime()}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Clean up the object URL after a short delay
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

/**
 * Build formatted plain text receipt for WhatsApp.
 *
 * Uses WhatsApp markdown: *bold* for emphasis.
 * Kept compact to stay within URL length limits (~2000 chars).
 */
export function buildReceiptText(data: ReceiptData): string {
  const dateStr = data.date.toLocaleDateString("es-VE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const timeStr = data.date.toLocaleTimeString("es-VE", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const itemLines = data.items
    .map((i) => `${i.name} x${i.quantity} $${i.lineTotal.toFixed(2)}`)
    .join("\n");

  const surchargeLines =
    data.surcharges && data.surcharges.length > 0
      ? data.surcharges
          .map((s) => `${s.name}: $${s.amount.toFixed(2)}`)
          .join("\n")
      : "";

  const bsLine =
    data.totalBs && data.exchangeRate
      ? `Bs.${data.totalBs.toFixed(2)} (${data.exchangeRate.toFixed(2)})`
      : "";

  const lines = [
    `*${data.businessName}*`,
    `${dateStr} ${timeStr}`,
    "",
    itemLines,
  ];

  if (surchargeLines) {
    lines.push("", surchargeLines);
  }

  lines.push("", `*Total: $${data.totalUsd.toFixed(2)}*`);

  if (bsLine) {
    lines.push(bsLine);
  }

  lines.push(`Pago: ${data.paymentMethod}`);

  return lines.join("\n");
}

// ============================================================
// Canvas image generator (internal, used by downloadReceiptImage)
// ============================================================

/**
 * Generate a receipt image as a Blob (PNG).
 *
 * Uses 2x device pixel ratio for crisp rendering on mobile.
 * Fixed width 400px logical for consistent appearance.
 */
function generateReceiptImage(data: ReceiptData): Blob | null {
  const dpr = 2;
  const W = 400;
  const pad = 28;
  const contentW = W - pad * 2;
  const lineH = 22;
  const sectionGap = 16;

  // Pre-calculate height
  let totalH = pad;
  totalH += 28 + 8 + 18 + sectionGap; // header
  totalH += 12; // separator
  totalH += data.items.length * lineH + sectionGap; // items
  totalH += 12; // separator
  if (data.surcharges && data.surcharges.length > 0) {
    totalH += data.surcharges.length * lineH + 12 + sectionGap;
  }
  totalH += 32 + 8; // total
  if (data.totalBs) totalH += 18;
  totalH += sectionGap;
  totalH += 18 + sectionGap; // payment method
  totalH += 18 + pad; // footer

  const canvas = document.createElement("canvas");
  canvas.width = W * dpr;
  canvas.height = totalH * dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.scale(dpr, dpr);

  // Background
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, W, totalH);

  // Border
  ctx.strokeStyle = "#E5E7EB";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, W - 1, totalH - 1);

  let y = pad;

  // Header
  ctx.fillStyle = "#111827";
  ctx.font = "bold 22px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(data.businessName, W / 2, y + 22);
  y += 28 + 8;

  const dateStr = data.date.toLocaleDateString("es-VE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const timeStr = data.date.toLocaleTimeString("es-VE", {
    hour: "2-digit",
    minute: "2-digit",
  });
  ctx.fillStyle = "#6B7280";
  ctx.font = "13px system-ui, sans-serif";
  ctx.fillText(`${dateStr} · ${timeStr}`, W / 2, y + 13);
  y += 18 + sectionGap;

  drawDashedLine(ctx, pad, y, W - pad, y);
  y += 12;

  // Items
  ctx.textAlign = "left";
  for (const item of data.items) {
    ctx.fillStyle = "#374151";
    ctx.font = "13px system-ui, sans-serif";
    const nameText = `${item.name} x${item.quantity}`;
    ctx.fillText(truncateText(ctx, nameText, contentW - 70), pad, y + 14);

    ctx.textAlign = "right";
    ctx.fillStyle = "#111827";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.fillText(`$${item.lineTotal.toFixed(2)}`, W - pad, y + 14);
    ctx.textAlign = "left";

    y += lineH;
  }
  y += sectionGap;

  drawDashedLine(ctx, pad, y, W - pad, y);
  y += 12;

  // Surcharges
  if (data.surcharges && data.surcharges.length > 0) {
    for (const s of data.surcharges) {
      ctx.fillStyle = "#6B7280";
      ctx.font = "12px system-ui, sans-serif";
      ctx.fillText(s.name, pad, y + 14);

      ctx.textAlign = "right";
      ctx.fillText(`$${s.amount.toFixed(2)}`, W - pad, y + 14);
      ctx.textAlign = "left";

      y += lineH;
    }

    drawDashedLine(ctx, pad, y, W - pad, y);
    y += 12 + sectionGap;
  }

  // Total
  ctx.fillStyle = "#111827";
  ctx.font = "bold 24px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`$${data.totalUsd.toFixed(2)}`, W / 2, y + 24);
  y += 32 + 8;

  if (data.totalBs && data.exchangeRate) {
    ctx.fillStyle = "#9CA3AF";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(
      `Bs. ${data.totalBs.toFixed(2)} (tasa ${data.exchangeRate.toFixed(2)})`,
      W / 2,
      y + 12,
    );
    y += 18;
  }
  y += sectionGap;

  // Payment method
  ctx.fillStyle = "#6B7280";
  ctx.font = "12px system-ui, sans-serif";
  ctx.fillText(`Pago: ${data.paymentMethod}`, W / 2, y + 12);
  y += 18 + sectionGap;

  // Footer
  ctx.fillStyle = "#D1D5DB";
  ctx.font = "11px system-ui, sans-serif";
  ctx.fillText("Gracias por su compra", W / 2, y + 11);

  // Convert to blob
  const dataUrl = canvas.toDataURL("image/png");
  const parts = dataUrl.split(",");
  if (parts.length < 2 || !parts[1]) return null;
  const byteString = atob(parts[1]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: "image/png" });
}

function drawDashedLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  ctx.save();
  ctx.strokeStyle = "#E5E7EB";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function truncateText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (
    truncated.length > 0 &&
    ctx.measureText(truncated + "...").width > maxWidth
  ) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + "...";
}
