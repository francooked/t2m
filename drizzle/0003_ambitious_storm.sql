ALTER TYPE "public"."message_status" ADD VALUE 'pending' BEFORE 'generating';--> statement-breakpoint
ALTER TYPE "public"."message_status" ADD VALUE 'correcting' BEFORE 'complete';--> statement-breakpoint
ALTER TABLE "message" RENAME COLUMN "source" TO "role";