-- Migration: Add product_images table for multi-image support.
--
-- Each product can have up to 5 images. sort_order=0 is the primary image.
-- The existing products.image_url field is kept as a denormalized cache
-- of the primary image for backward compatibility.

CREATE TABLE IF NOT EXISTS "product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"business_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"alt_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_product_images_product" ON "product_images" USING btree ("product_id");
--> statement-breakpoint
CREATE INDEX "idx_product_images_business" ON "product_images" USING btree ("business_id");
--> statement-breakpoint
CREATE INDEX "idx_product_images_sort" ON "product_images" USING btree ("product_id","sort_order");
--> statement-breakpoint
-- Migrate existing product images: create a product_images row for each
-- product that already has an image_url set. These become the primary image
-- (sort_order = 0) for backward compatibility.
INSERT INTO "product_images" ("product_id", "business_id", "storage_key", "sort_order")
SELECT "id", "business_id", "image_url", 0
FROM "products"
WHERE "image_url" IS NOT NULL AND "image_url" != '';
