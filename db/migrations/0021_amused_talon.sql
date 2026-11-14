CREATE TABLE "fixtures" (
	"id" serial PRIMARY KEY NOT NULL,
	"property_id" integer NOT NULL,
	"name" text NOT NULL,
	"area" text,
	"condition" text DEFAULT 'working' NOT NULL,
	"condition_at" timestamp with time zone,
	"cost" integer,
	"bought_on" date,
	"model" text,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_kit" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" integer NOT NULL,
	"property_id" integer,
	"expected" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN "area" text;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN "kind" text;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "reason" text;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "reservation_id" integer;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "chargeable" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "unit_cost" integer;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "claim_settled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "fixture_id" integer;--> statement-breakpoint
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_kit" ADD CONSTRAINT "property_kit_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_kit" ADD CONSTRAINT "property_kit_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fixtures_property_idx" ON "fixtures" USING btree ("property_id");--> statement-breakpoint
CREATE UNIQUE INDEX "property_kit_item_property_idx" ON "property_kit" USING btree ("item_id","property_id");--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_fixture_id_fixtures_id_fk" FOREIGN KEY ("fixture_id") REFERENCES "public"."fixtures"("id") ON DELETE set null ON UPDATE no action;