CREATE TABLE IF NOT EXISTS "push_subscriptions" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "business_id" uuid NOT NULL REFERENCES "businesses"("id"),
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "endpoint" text NOT NULL,
  "subscription" jsonb NOT NULL,
  "user_agent" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_push_subs_business" ON "push_subscriptions" ("business_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_push_subs_endpoint" ON "push_subscriptions" ("endpoint");
