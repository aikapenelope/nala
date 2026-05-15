/**
 * Receipt image generator using Canvas API.
 *
 * Renders a professional receipt as a PNG image that can be shared
 * via Web Share API (WhatsApp, Instagram, etc.) or downloaded.
 *
 * Design: white background, clean typography, ticket-style layout
 * with dashed separators. Optimized for mobile sharing (2x DPR).
 *
 * No external dependencies — uses only browser Canvas API.
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

/** Whether the browser supports sharing files via Web Share API. */
export function canShareFiles(): boolean {
  if (!import.meta.client) return false;
  return !!navigator.share && !!navigator.canShare;
}

/**
 * Generate a receipt image as a Blob (PNG).
 *
 * Uses 2x device pixel ratio for crisp rendering on mobile screens.
 * The receipt is rendered at a fixed width (400px logical) to ensure
 * consistent appearance across devices.
 */
export function generateReceiptImage(data: ReceiptData): Blob | null {
  if (!import.meta.client) return null;

  const dpr = 2;
  const W = 400;
  const pad = 28;
  const contentW = W - pad * 2;

  // Pre-calculate height based on content
  const lineH = 22;
  const sectionGap = 16;
  let totalH = pad; // top padding

  // Header: business name + date
  totalH += 28 + 8 + 18 + sectionGap; // name + gap + date + section gap

  // Separator
  totalH += 12;

  // Items
  totalH += data.items.length * lineH + sectionGap;

  // Separator
  totalH += 12;

  // Surcharges
  if (data.surcharges && data.surcharges.length > 0) {
    totalH += data.surcharges.length * lineH + 12 + sectionGap;
  }

  // Total section
  totalH += 32 + 8; // total line + gap
  if (data.totalBs) totalH += 18; // Bs line
  totalH += sectionGap;

  // Payment method
  totalH += 18 + sectionGap;

  // Footer
  totalH += 18 + pad; // thank you + bottom padding

  // Create canvas
  const canvas = document.createElement("canvas");
  canvas.width = W * dpr;
  canvas.height = totalH * dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.scale(dpr, dpr);

  // Background
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, W, totalH);

  // Subtle border
  ctx.strokeStyle = "#E5E7EB";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, W - 1, totalH - 1);

  let y = pad;

  // --- Header ---
  ctx.fillStyle = "#111827";
  ctx.font = "bold 22px 'Plus Jakarta Sans', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(data.businessName, W / 2, y + 22);
  y += 28 + 8;

  // Date
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
  ctx.font = "500 13px 'Plus Jakarta Sans', system-ui, sans-serif";
  ctx.fillText(`${dateStr} · ${timeStr}`, W / 2, y + 13);
  y += 18 + sectionGap;

  // --- Dashed separator ---
  drawDashedLine(ctx, pad, y, W - pad, y);
  y += 12;

  // --- Items ---
  ctx.textAlign = "left";
  for (const item of data.items) {
    ctx.fillStyle = "#374151";
    ctx.font = "500 13px 'Plus Jakarta Sans', system-ui, sans-serif";
    const nameText = `${item.name} x${item.quantity}`;
    ctx.fillText(truncateText(ctx, nameText, contentW - 70), pad, y + 14);

    ctx.textAlign = "right";
    ctx.fillStyle = "#111827";
    ctx.font = "600 13px 'Plus Jakarta Sans', system-ui, sans-serif";
    ctx.fillText(`$${item.lineTotal.toFixed(2)}`, W - pad, y + 14);
    ctx.textAlign = "left";

    y += lineH;
  }
  y += sectionGap;

  // --- Dashed separator ---
  drawDashedLine(ctx, pad, y, W - pad, y);
  y += 12;

  // --- Surcharges ---
  if (data.surcharges && data.surcharges.length > 0) {
    for (const s of data.surcharges) {
      ctx.fillStyle = "#6B7280";
      ctx.font = "500 12px 'Plus Jakarta Sans', system-ui, sans-serif";
      ctx.fillText(s.name, pad, y + 14);

      ctx.textAlign = "right";
      ctx.fillText(`$${s.amount.toFixed(2)}`, W - pad, y + 14);
      ctx.textAlign = "left";

      y += lineH;
    }

    drawDashedLine(ctx, pad, y, W - pad, y);
    y += 12 + sectionGap;
  }

  // --- Total ---
  ctx.fillStyle = "#111827";
  ctx.font = "bold 24px 'Plus Jakarta Sans', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`$${data.totalUsd.toFixed(2)}`, W / 2, y + 24);
  y += 32 + 8;

  if (data.totalBs && data.exchangeRate) {
    ctx.fillStyle = "#9CA3AF";
    ctx.font = "500 12px 'Plus Jakarta Sans', system-ui, sans-serif";
    ctx.fillText(
      `Bs. ${data.totalBs.toFixed(2)} (tasa ${data.exchangeRate.toFixed(2)})`,
      W / 2,
      y + 12,
    );
    y += 18;
  }
  y += sectionGap;

  // --- Payment method ---
  ctx.fillStyle = "#6B7280";
  ctx.font = "500 12px 'Plus Jakarta Sans', system-ui, sans-serif";
  ctx.fillText(`Pago: ${data.paymentMethod}`, W / 2, y + 12);
  y += 18 + sectionGap;

  // --- Footer ---
  ctx.fillStyle = "#D1D5DB";
  ctx.font = "500 11px 'Plus Jakarta Sans', system-ui, sans-serif";
  ctx.fillText("Gracias por su compra", W / 2, y + 11);

  // Convert to blob synchronously via toBlob workaround
  const dataUrl = canvas.toDataURL("image/png");
  const byteString = atob(dataUrl.split(",")[1]!);
  const mimeString = dataUrl.split(",")[0]!.split(":")[1]!.split(";")[0]!;
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeString });
}

/**
 * Share a receipt via WhatsApp as an image.
 *
 * Strategy:
 * 1. Generate receipt image with Canvas
 * 2. Try Web Share API with the image file (opens native share sheet)
 * 3. If Web Share not available, open wa.me with text fallback
 *
 * @param data - Receipt data for image generation
 * @param phone - Optional phone number (with country code) to target WhatsApp directly
 * @returns "shared" if Web Share succeeded, "fallback" if text was used
 */
export async function shareReceipt(
  data: ReceiptData,
  phone?: string | null,
): Promise<"shared" | "fallback"> {
  const blob = generateReceiptImage(data);

  // Try Web Share API with image file
  if (blob && canShareFiles()) {
    const file = new File([blob], "recibo.png", { type: "image/png" });
    const shareData = {
      title: `Recibo - ${data.businessName}`,
      text: `Recibo de $${data.totalUsd.toFixed(2)}`,
      files: [file],
    };

    try {
      if (navigator.canShare(shareData)) {
        await navigator.share(shareData);
        return "shared";
      }
    } catch {
      // User cancelled or share failed — fall through to WhatsApp text
    }
  }

  // Fallback: open WhatsApp with formatted text
  const text = buildReceiptText(data);
  const encoded = encodeURIComponent(text);
  const cleanPhone = phone?.replace(/[^0-9]/g, "") ?? "";
  const waUrl = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;
  window.open(waUrl, "_blank");
  return "fallback";
}

/**
 * Build a formatted plain text receipt for WhatsApp.
 * Used as fallback when Web Share API is not available.
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
    .map((i) => `  ${i.name} x${i.quantity} — $${i.lineTotal.toFixed(2)}`)
    .join("\n");

  const surchargeLines =
    data.surcharges && data.surcharges.length > 0
      ? data.surcharges.map((s) => `  ${s.name}: $${s.amount.toFixed(2)}`).join("\n")
      : "";

  const bsLine =
    data.totalBs && data.exchangeRate
      ? `\nBs. ${data.totalBs.toFixed(2)} (tasa ${data.exchangeRate.toFixed(2)})`
      : "";

  return [
    `📋 *${data.businessName}*`,
    `${dateStr} ${timeStr}`,
    `─────────────────`,
    itemLines,
    `─────────────────`,
    surchargeLines ? `${surchargeLines}\n─────────────────` : "",
    `*Total: $${data.totalUsd.toFixed(2)}*${bsLine}`,
    `Pago: ${data.paymentMethod}`,
    ``,
    `Gracias por su compra! 🙏`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Draw a dashed line on the canvas. */
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

/** Truncate text to fit within a given width, adding ellipsis. */
function truncateText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 0 && ctx.measureText(truncated + "...").width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + "...";
}
