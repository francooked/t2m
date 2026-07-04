ALTER TABLE "chat" ALTER COLUMN "target_language" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "exercise" ALTER COLUMN "target_language" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "user_profile" ALTER COLUMN "native_language" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."language";--> statement-breakpoint
CREATE TYPE "public"."language" AS ENUM('spa', 'eng');--> statement-breakpoint
ALTER TABLE "chat" ALTER COLUMN "target_language" SET DATA TYPE "public"."language" USING "target_language"::"public"."language";--> statement-breakpoint
ALTER TABLE "exercise" ALTER COLUMN "target_language" SET DATA TYPE "public"."language" USING "target_language"::"public"."language";--> statement-breakpoint
ALTER TABLE "user_profile" ALTER COLUMN "native_language" SET DATA TYPE "public"."language" USING "native_language"::"public"."language";