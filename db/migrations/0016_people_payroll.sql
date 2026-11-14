CREATE TYPE "public"."attendance_status" AS ENUM('present', 'absent', 'half', 'leave', 'off');--> statement-breakpoint
CREATE TYPE "public"."pay_type" AS ENUM('monthly', 'daily');--> statement-breakpoint
CREATE TYPE "public"."payroll_status" AS ENUM('draft', 'locked', 'paid');--> statement-breakpoint
CREATE TABLE "advances" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"date" date NOT NULL,
	"amount" integer NOT NULL,
	"monthly_recovery" integer NOT NULL,
	"recovered" integer DEFAULT 0 NOT NULL,
	"note" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"date" date NOT NULL,
	"status" "attendance_status" NOT NULL,
	"marked_by" integer,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" serial PRIMARY KEY NOT NULL,
	"business" "business" NOT NULL,
	"ops_user_id" integer,
	"name" text NOT NULL,
	"phone" text,
	"role_title" text,
	"join_date" date,
	"exit_date" date,
	"pay_type" "pay_type" DEFAULT 'monthly' NOT NULL,
	"monthly_salary" integer,
	"daily_rate" integer,
	"pay_to" text,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"business" "business" NOT NULL,
	"month" text NOT NULL,
	"status" "payroll_status" DEFAULT 'draft' NOT NULL,
	"locked_by" integer,
	"locked_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"paid_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payslips" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"days_in_month" integer NOT NULL,
	"payable_days" integer NOT NULL,
	"base" integer NOT NULL,
	"incentives" integer DEFAULT 0 NOT NULL,
	"advance_recovery" integer DEFAULT 0 NOT NULL,
	"deductions" integer DEFAULT 0 NOT NULL,
	"net" integer NOT NULL,
	"lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"note" text,
	"expense_id" integer
);
--> statement-breakpoint
ALTER TABLE "advances" ADD CONSTRAINT "advances_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advances" ADD CONSTRAINT "advances_created_by_ops_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."ops_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_marked_by_ops_users_id_fk" FOREIGN KEY ("marked_by") REFERENCES "public"."ops_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_ops_user_id_ops_users_id_fk" FOREIGN KEY ("ops_user_id") REFERENCES "public"."ops_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_locked_by_ops_users_id_fk" FOREIGN KEY ("locked_by") REFERENCES "public"."ops_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_run_id_payroll_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."payroll_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_employee_date_idx" ON "attendance" USING btree ("employee_id","date");--> statement-breakpoint
CREATE INDEX "attendance_date_idx" ON "attendance" USING btree ("date");--> statement-breakpoint
CREATE INDEX "employees_business_idx" ON "employees" USING btree ("business");--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_runs_business_month_idx" ON "payroll_runs" USING btree ("business","month");--> statement-breakpoint
CREATE UNIQUE INDEX "payslips_run_employee_idx" ON "payslips" USING btree ("run_id","employee_id");