CREATE TYPE "public"."telegram_session_step" AS ENUM('AWAITING_PRODUCT', 'AWAITING_QUANTITY', 'AWAITING_SPECIFICATION', 'AWAITING_LOCATION', 'AWAITING_DEADLINE', 'AWAITING_BUSINESS_NAME', 'AWAITING_PHONE', 'DONE');--> statement-breakpoint
ALTER TYPE "public"."lead_source" ADD VALUE 'TELEGRAM' BEFORE 'WEBSITE';--> statement-breakpoint
CREATE TABLE "telegram_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"chat_id" text NOT NULL,
	"step" "telegram_session_step" DEFAULT 'AWAITING_PRODUCT' NOT NULL,
	"product_id" text,
	"quantity" text,
	"specification" text,
	"location" text,
	"deadline" text,
	"business_name" text,
	"phone" text,
	"telegram_username" text,
	"telegram_first_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "telegram_sessions_chat_id_unique" UNIQUE("chat_id")
);
--> statement-breakpoint
ALTER TABLE "telegram_sessions" ADD CONSTRAINT "telegram_sessions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;