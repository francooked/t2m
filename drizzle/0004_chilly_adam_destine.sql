CREATE TYPE "public"."exercise_type" AS ENUM('full_answer');--> statement-breakpoint
CREATE TYPE "public"."srs_algorithm" AS ENUM('fsrs');--> statement-breakpoint
CREATE TABLE "exercise" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" "exercise_type" NOT NULL,
	"source" jsonb NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"archived_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "user_srs_profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"algorithm" "srs_algorithm" NOT NULL,
	"setup" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "message" ALTER COLUMN "status" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "exercise" ADD CONSTRAINT "exercise_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_srs_profile" ADD CONSTRAINT "user_srs_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exercise_userid_createdat_desc_idx" ON "exercise" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "exercise_userid_createdat_desc_active_idx" ON "exercise" USING btree ("user_id","created_at" DESC NULLS LAST) WHERE "exercise"."archived_at" is null;