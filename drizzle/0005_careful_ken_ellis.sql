CREATE TYPE "public"."manufacturer_verification_status" AS ENUM('PENDING_REVIEW', 'VERIFIED', 'REJECTED');--> statement-breakpoint
ALTER TABLE "manufacturers" ADD COLUMN "full_name" text;--> statement-breakpoint
ALTER TABLE "manufacturers" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "manufacturers" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "manufacturers" ADD COLUMN "mobile" text;--> statement-breakpoint
ALTER TABLE "manufacturers" ADD COLUMN "registration_number" text;--> statement-breakpoint
ALTER TABLE "manufacturers" ADD COLUMN "number_of_employees" text;--> statement-breakpoint
ALTER TABLE "manufacturers" ADD COLUMN "pan_number" text;--> statement-breakpoint
ALTER TABLE "manufacturers" ADD COLUMN "verification_status" "manufacturer_verification_status" DEFAULT 'PENDING_REVIEW' NOT NULL;--> statement-breakpoint
ALTER TABLE "manufacturers" ADD CONSTRAINT "manufacturers_email_unique" UNIQUE("email");