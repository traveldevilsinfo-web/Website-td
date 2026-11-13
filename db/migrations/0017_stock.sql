CREATE TYPE "public"."stock_kind" AS ENUM('in', 'issue', 'return', 'damaged', 'count');--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"business" "business" NOT NULL,
	"name" text NOT NULL,
	"unit" text DEFAULT 'piece' NOT NULL,
	"category" text,
	"reorder_level" integer DEFAULT 0 NOT NULL,
	"cost_per_unit" integer,
	"per_turnover" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" integer NOT NULL,
	"property_id" integer,
	"qty" integer NOT NULL,
	"kind" "stock_kind" NOT NULL,
	"trip_batch_id" integer,
	"turnover_id" integer,
	"note" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_trip_batch_id_trip_batches_id_fk" FOREIGN KEY ("trip_batch_id") REFERENCES "public"."trip_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_turnover_id_turnovers_id_fk" FOREIGN KEY ("turnover_id") REFERENCES "public"."turnovers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_created_by_ops_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."ops_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_items_business_name_idx" ON "inventory_items" USING btree ("business","name");--> statement-breakpoint
CREATE INDEX "stock_movements_item_idx" ON "stock_movements" USING btree ("item_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_movements_turnover_item_idx" ON "stock_movements" USING btree ("turnover_id","item_id");