CREATE TYPE "public"."message_status" AS ENUM('generating', 'complete', 'failed');--> statement-breakpoint
ALTER TABLE "message" ADD COLUMN "status" "message_status";