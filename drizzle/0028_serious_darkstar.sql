CREATE TYPE "public"."chat_kind" AS ENUM('conversation', 'one_shot');--> statement-breakpoint
ALTER TABLE "chat" ADD COLUMN "kind" "chat_kind" NOT NULL;--> statement-breakpoint
ALTER TABLE "message" ADD COLUMN "intent" text;