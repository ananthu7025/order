ALTER TYPE "public"."telegram_session_step" ADD VALUE 'AWAITING_AGENT';--> statement-breakpoint
ALTER TABLE "telegram_sessions" ADD COLUMN "history" jsonb;