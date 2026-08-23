UPDATE "exercise" SET "payload" = jsonb_build_object('type', "type"::text, 'version', "version", 'payload', "payload");--> statement-breakpoint
ALTER TABLE "exercise" DROP COLUMN "type";--> statement-breakpoint
ALTER TABLE "exercise" DROP COLUMN "version";--> statement-breakpoint
DROP TYPE "public"."exercise_type";