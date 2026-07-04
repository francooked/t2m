ALTER TABLE "chat" ALTER COLUMN "target_language" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "exercise" ALTER COLUMN "target_language" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "user_profile" ALTER COLUMN "native_language" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."language_code";--> statement-breakpoint
CREATE TYPE "public"."language_code" AS ENUM('es', 'en');--> statement-breakpoint
ALTER TABLE "chat" ALTER COLUMN "target_language" SET DATA TYPE "public"."language_code" USING "target_language"::"public"."language_code";--> statement-breakpoint
ALTER TABLE "exercise" ALTER COLUMN "target_language" SET DATA TYPE "public"."language_code" USING "target_language"::"public"."language_code";--> statement-breakpoint
ALTER TABLE "user_profile" ALTER COLUMN "native_language" SET DATA TYPE "public"."language_code" USING "native_language"::"public"."language_code";