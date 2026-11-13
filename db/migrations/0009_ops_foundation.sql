CREATE TYPE "public"."business" AS ENUM('td', 'finzo');--> statement-breakpoint
CREATE TYPE "public"."expense_status" AS ENUM('needs_amount', 'submitted', 'approved', 'rejected', 'paid');--> statement-breakpoint
CREATE TYPE "public"."ops_role" AS ENUM('owner', 'manager', 'staff');--> statement-breakpoint
CREATE TYPE "public"."paid_via" AS ENUM('cash', 'upi', 'bank', 'card');--> statement-breakpoint
CREATE TABLE "expense_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"business" "business" NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'variable' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"business" "business" NOT NULL,
	"date" date NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	"category_id" integer NOT NULL,
	"vendor_id" integer,
	"trip_batch_id" integer,
	"paid_via" "paid_via",
	"reimburse" boolean DEFAULT false NOT NULL,
	"receipt_path" text,
	"note" text,
	"status" "expense_status" DEFAULT 'submitted' NOT NULL,
	"created_by" integer NOT NULL,
	"approved_by" integer,
	"approved_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"paid_ref" text,
	"recurring_id" integer,
	"period" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"password_hash" text NOT NULL,
	"role" "ops_role" DEFAULT 'staff' NOT NULL,
	"businesses" text[] DEFAULT '{}' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ops_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "recurring_expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"business" "business" NOT NULL,
	"name" text NOT NULL,
	"amount" integer,
	"category_id" integer NOT NULL,
	"vendor_id" integer,
	"day_of_month" integer NOT NULL,
	"paid_via" "paid_via",
	"active" boolean DEFAULT true NOT NULL,
	"start_month" text NOT NULL,
	"end_month" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" serial PRIMARY KEY NOT NULL,
	"business" "business" NOT NULL,
	"name" text NOT NULL,
	"kind" text,
	"phone" text,
	"gstin" text,
	"pay_to" text,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_expense_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_trip_batch_id_trip_batches_id_fk" FOREIGN KEY ("trip_batch_id") REFERENCES "public"."trip_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_ops_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."ops_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_approved_by_ops_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."ops_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_recurring_id_recurring_expenses_id_fk" FOREIGN KEY ("recurring_id") REFERENCES "public"."recurring_expenses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_sessions" ADD CONSTRAINT "ops_sessions_user_id_ops_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."ops_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_category_id_expense_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "expense_categories_business_name_idx" ON "expense_categories" USING btree ("business","name");--> statement-breakpoint
CREATE INDEX "expenses_business_date_idx" ON "expenses" USING btree ("business","date");--> statement-breakpoint
CREATE INDEX "expenses_business_status_idx" ON "expenses" USING btree ("business","status");--> statement-breakpoint
CREATE INDEX "expenses_created_by_idx" ON "expenses" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "expenses_recurring_period_idx" ON "expenses" USING btree ("recurring_id","period");--> statement-breakpoint
CREATE INDEX "vendors_business_idx" ON "vendors" USING btree ("business");--> statement-breakpoint
INSERT INTO "expense_categories" ("business", "name", "kind", "sort") VALUES
('td', 'Transport', 'variable', 0),
('td', 'Hotels & stays', 'variable', 1),
('td', 'Food', 'variable', 2),
('td', 'Permits & entry', 'variable', 3),
('td', 'Captain / trip leader fee', 'variable', 4),
('td', 'Gear & equipment', 'variable', 5),
('td', 'Marketing & ads', 'variable', 6),
('td', 'Office rent', 'fixed', 7),
('td', 'Software & subscriptions', 'fixed', 8),
('td', 'Salaries', 'salary', 9),
('td', 'Misc', 'variable', 10),
('finzo', 'Rent to landlord', 'fixed', 0),
('finzo', 'Electricity', 'variable', 1),
('finzo', 'Water', 'variable', 2),
('finzo', 'Internet / Wi-Fi', 'fixed', 3),
('finzo', 'Society maintenance', 'fixed', 4),
('finzo', 'Housekeeping & laundry', 'variable', 5),
('finzo', 'Linen & toiletries', 'inventory', 6),
('finzo', 'Repairs & maintenance', 'variable', 7),
('finzo', 'Furniture & appliances', 'variable', 8),
('finzo', 'Platform fees', 'variable', 9),
('finzo', 'Salaries', 'salary', 10),
('finzo', 'Misc', 'variable', 11)
ON CONFLICT DO NOTHING;