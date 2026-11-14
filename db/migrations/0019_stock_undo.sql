ALTER TABLE "stock_movements" ADD COLUMN "group_id" text;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "undone_at" timestamp with time zone;