-- RFM scoring columns on customers table.
-- These are calculated periodically and on each sale, not user-editable.
-- Enables automatic customer segmentation (champion, loyal, at_risk, etc.)

ALTER TABLE "customers" ADD COLUMN "rfm_recency" integer;
ALTER TABLE "customers" ADD COLUMN "rfm_frequency" integer;
ALTER TABLE "customers" ADD COLUMN "rfm_monetary" numeric(12, 2);
ALTER TABLE "customers" ADD COLUMN "rfm_score" text;
ALTER TABLE "customers" ADD COLUMN "rfm_segment" text;
ALTER TABLE "customers" ADD COLUMN "rfm_calculated_at" timestamp with time zone;
