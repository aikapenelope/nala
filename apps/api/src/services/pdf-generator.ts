/**
 * PDF generation service using pdfmake.
 *
 * Generates report PDFs for:
 * - Daily summary
 * - Weekly summary
 * - Financial P&L
 *
 * Each report follows a consistent layout:
 * - Header with business name and date
 * - Summary metrics
 * - Data tables
 * - Footer with generation timestamp
 */

/**
 * pdfmake types.
 *
 * We define minimal types here instead of using @types/pdfmake because
 * the type definitions don't match the actual module structure in Node.js.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
interface PdfContent {
  text?: any;
  columns?: any[];
  table?: any;
  layout?: any;
  margin?: [number, number, number, number];
  fontSize?: number;
  bold?: boolean;
  color?: string;
  alignment?: string;
  [key: string]: any;
}

interface PdfDocDefinition {
  content: PdfContent[];
  defaultStyle?: Record<string, any>;
}

/* eslint-enable @typescript-eslint/no-explicit-any */

// pdfmake exposes createPdf for browser; for Node.js we use the build directly.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PdfMake = require("pdfmake/build/pdfmake") as {
  createPdf: (
    docDef: PdfDocDefinition,
    tableLayouts?: unknown,
    fonts?: unknown,
    vfs?: unknown,
  ) => { getBuffer: (cb: (buffer: Uint8Array) => void) => void };
};

/**
 * Generate a PDF from a document definition.
 * Returns a Promise that resolves with the PDF as an ArrayBuffer
 * (compatible with Hono's c.body()).
 */
function generatePdfBuffer(docDef: PdfDocDefinition): Promise<ArrayBuffer> {
  return new Promise((resolve) => {
    const pdf = PdfMake.createPdf(docDef);
    pdf.getBuffer((buffer: Uint8Array) => {
      const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
      resolve(ab);
    });
  });
}

type Content = PdfContent;

/** Format a number as USD currency string. */
function usd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/** Format a percentage with sign. */
function pct(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value}%`;
}

/** Common header for all reports. */
function reportHeader(title: string, businessName: string): Content {
  return {
    columns: [
      {
        text: [
          { text: `${businessName}\n`, fontSize: 14, bold: true },
          { text: title, fontSize: 11, color: "#666666" },
        ],
      },
      {
        text: new Date().toLocaleDateString("es-VE", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        alignment: "right" as const,
        fontSize: 10,
        color: "#999999",
      },
    ],
    margin: [0, 0, 0, 20] as [number, number, number, number],
  };
}

/** Common footer. */
function reportFooter(): Content {
  return {
    text: `Generado por Nova el ${new Date().toLocaleString("es-VE")}`,
    fontSize: 8,
    color: "#AAAAAA",
    alignment: "center" as const,
    margin: [0, 30, 0, 0] as [number, number, number, number],
  };
}

// ============================================================
// Daily Summary PDF
// ============================================================

export interface DailySummaryData {
  totalSales: number;
  totalCount: number;
  avgTicket: number;
  vsPreviousDay: number;
  vsSameDayLastWeek: number;
  topProducts: Array<{ name: string; qty: number; total: number }>;
  salesByMethod: Record<string, number>;
}

export async function generateDailyPdf(
  data: DailySummaryData,
  businessName: string,
): Promise<ArrayBuffer> {
  const docDef: PdfDocDefinition = {
    content: [
      reportHeader("Resumen Diario", businessName),

      // Summary metrics
      {
        columns: [
          {
            text: [
              { text: "Ventas totales\n", fontSize: 9, color: "#666666" },
              { text: usd(data.totalSales), fontSize: 18, bold: true },
            ],
          },
          {
            text: [
              { text: "Transacciones\n", fontSize: 9, color: "#666666" },
              { text: String(data.totalCount), fontSize: 18, bold: true },
            ],
          },
          {
            text: [
              { text: "Ticket promedio\n", fontSize: 9, color: "#666666" },
              { text: usd(data.avgTicket), fontSize: 18, bold: true },
            ],
          },
        ],
        margin: [0, 0, 0, 15] as [number, number, number, number],
      },

      // Comparisons
      {
        text: [
          { text: "vs ayer: ", fontSize: 9, color: "#666666" },
          {
            text: pct(data.vsPreviousDay),
            fontSize: 9,
            bold: true,
            color: data.vsPreviousDay >= 0 ? "#16a34a" : "#dc2626",
          },
          { text: "   vs misma dia semana pasada: ", fontSize: 9, color: "#666666" },
          {
            text: pct(data.vsSameDayLastWeek),
            fontSize: 9,
            bold: true,
            color: data.vsSameDayLastWeek >= 0 ? "#16a34a" : "#dc2626",
          },
        ],
        margin: [0, 0, 0, 20] as [number, number, number, number],
      },

      // Top products table
      ...(data.topProducts.length > 0
        ? [
            {
              text: "Productos mas vendidos",
              fontSize: 11,
              bold: true,
              margin: [0, 0, 0, 8] as [number, number, number, number],
            } as Content,
            {
              table: {
                headerRows: 1,
                widths: ["*", "auto", "auto"],
                body: [
                  [
                    { text: "Producto", bold: true, fontSize: 9 },
                    { text: "Cant.", bold: true, fontSize: 9, alignment: "right" as const },
                    { text: "Total", bold: true, fontSize: 9, alignment: "right" as const },
                  ],
                  ...data.topProducts.map((p) => [
                    { text: p.name, fontSize: 9 },
                    { text: String(p.qty), fontSize: 9, alignment: "right" as const },
                    { text: usd(p.total), fontSize: 9, alignment: "right" as const },
                  ]),
                ],
              },
              layout: "lightHorizontalLines",
              margin: [0, 0, 0, 15] as [number, number, number, number],
            } as Content,
          ]
        : []),

      // Payment methods
      ...(Object.keys(data.salesByMethod).length > 0
        ? [
            {
              text: "Ventas por metodo de pago",
              fontSize: 11,
              bold: true,
              margin: [0, 0, 0, 8] as [number, number, number, number],
            } as Content,
            {
              table: {
                headerRows: 1,
                widths: ["*", "auto"],
                body: [
                  [
                    { text: "Metodo", bold: true, fontSize: 9 },
                    { text: "Total", bold: true, fontSize: 9, alignment: "right" as const },
                  ],
                  ...Object.entries(data.salesByMethod).map(([method, total]) => [
                    { text: method, fontSize: 9 },
                    { text: usd(total), fontSize: 9, alignment: "right" as const },
                  ]),
                ],
              },
              layout: "lightHorizontalLines",
            } as Content,
          ]
        : []),

      reportFooter(),
    ],
    defaultStyle: { font: "Roboto" },
  };

  return generatePdfBuffer(docDef);
}

// ============================================================
// Weekly Summary PDF
// ============================================================

export interface WeeklySummaryData {
  totalSales: number;
  totalCount: number;
  vsPrevPeriod: number;
  dailyBreakdown: Array<{ day: string; amount: number }>;
  bestDay: string | null;
  topProduct: string | null;
}

export async function generateWeeklyPdf(
  data: WeeklySummaryData,
  businessName: string,
  period: string,
): Promise<ArrayBuffer> {
  const periodLabel =
    period === "week"
      ? "Esta semana"
      : period === "month"
        ? "Este mes"
        : period === "last_month"
          ? "Mes anterior"
          : "Periodo";

  const docDef: PdfDocDefinition = {
    content: [
      reportHeader(`Resumen: ${periodLabel}`, businessName),

      // Summary
      {
        columns: [
          {
            text: [
              { text: "Ventas totales\n", fontSize: 9, color: "#666666" },
              { text: usd(data.totalSales), fontSize: 18, bold: true },
            ],
          },
          {
            text: [
              { text: "Transacciones\n", fontSize: 9, color: "#666666" },
              { text: String(data.totalCount), fontSize: 18, bold: true },
            ],
          },
          {
            text: [
              { text: "vs periodo anterior\n", fontSize: 9, color: "#666666" },
              {
                text: pct(data.vsPrevPeriod),
                fontSize: 18,
                bold: true,
                color: data.vsPrevPeriod >= 0 ? "#16a34a" : "#dc2626",
              },
            ],
          },
        ],
        margin: [0, 0, 0, 15] as [number, number, number, number],
      },

      // Highlights
      {
        text: [
          ...(data.bestDay
            ? [
                { text: "Mejor dia: ", fontSize: 9, color: "#666666" },
                { text: `${data.bestDay}  `, fontSize: 9, bold: true },
              ]
            : []),
          ...(data.topProduct
            ? [
                { text: "Producto estrella: ", fontSize: 9, color: "#666666" },
                { text: data.topProduct, fontSize: 9, bold: true },
              ]
            : []),
        ],
        margin: [0, 0, 0, 20] as [number, number, number, number],
      },

      // Daily breakdown table
      ...(data.dailyBreakdown.length > 0
        ? [
            {
              text: "Desglose diario",
              fontSize: 11,
              bold: true,
              margin: [0, 0, 0, 8] as [number, number, number, number],
            } as Content,
            {
              table: {
                headerRows: 1,
                widths: ["*", "auto"],
                body: [
                  [
                    { text: "Dia", bold: true, fontSize: 9 },
                    { text: "Ventas", bold: true, fontSize: 9, alignment: "right" as const },
                  ],
                  ...data.dailyBreakdown.map((d) => [
                    { text: d.day, fontSize: 9 },
                    { text: usd(d.amount), fontSize: 9, alignment: "right" as const },
                  ]),
                ],
              },
              layout: "lightHorizontalLines",
            } as Content,
          ]
        : []),

      reportFooter(),
    ],
    defaultStyle: { font: "Roboto" },
  };

  return generatePdfBuffer(docDef);
}

// ============================================================
// Financial P&L PDF
// ============================================================

export interface FinancialData {
  revenue: number;
  costOfGoods: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
  grossMargin: number;
  netMargin: number;
}

export async function generateFinancialPdf(
  data: FinancialData,
  businessName: string,
  period: string,
): Promise<ArrayBuffer> {
  const periodLabel =
    period === "today"
      ? "Hoy"
      : period === "week"
        ? "Esta semana"
        : period === "month"
          ? "Este mes"
          : period === "last_month"
            ? "Mes anterior"
            : "Periodo";

  const docDef: PdfDocDefinition = {
    content: [
      reportHeader(`Estado de Resultados: ${periodLabel}`, businessName),

      // P&L table
      {
        table: {
          headerRows: 0,
          widths: ["*", "auto"],
          body: [
            [
              { text: "Ingresos por ventas", fontSize: 10 },
              { text: usd(data.revenue), fontSize: 10, alignment: "right" as const, bold: true },
            ],
            [
              { text: "(-) Costo de ventas", fontSize: 10, color: "#666666" },
              { text: usd(data.costOfGoods), fontSize: 10, alignment: "right" as const },
            ],
            [
              { text: "= Ganancia bruta", fontSize: 10, bold: true },
              {
                text: usd(data.grossProfit),
                fontSize: 10,
                alignment: "right" as const,
                bold: true,
                color: data.grossProfit >= 0 ? "#16a34a" : "#dc2626",
              },
            ],
            [
              { text: `  Margen bruto: ${data.grossMargin}%`, fontSize: 9, color: "#999999" },
              { text: "", fontSize: 9 },
            ],
            [
              { text: "(-) Gastos operativos", fontSize: 10, color: "#666666" },
              { text: usd(data.expenses), fontSize: 10, alignment: "right" as const },
            ],
            [
              { text: "= Ganancia neta", fontSize: 11, bold: true },
              {
                text: usd(data.netProfit),
                fontSize: 11,
                alignment: "right" as const,
                bold: true,
                color: data.netProfit >= 0 ? "#16a34a" : "#dc2626",
              },
            ],
            [
              { text: `  Margen neto: ${data.netMargin}%`, fontSize: 9, color: "#999999" },
              { text: "", fontSize: 9 },
            ],
          ],
        },
        layout: {
          hLineWidth: (i: number, node: { table: { body: unknown[] } }) =>
            i === 0 || i === node.table.body.length ? 1 : 0.5,
          vLineWidth: () => 0,
          hLineColor: () => "#EEEEEE",
          paddingTop: () => 6,
          paddingBottom: () => 6,
        },
      },

      reportFooter(),
    ],
    defaultStyle: { font: "Roboto" },
  };

  return generatePdfBuffer(docDef);
}
