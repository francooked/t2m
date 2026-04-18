CREATE TYPE "public"."fsrs_rating" AS ENUM('again', 'hard', 'good', 'easy');--> statement-breakpoint
CREATE TABLE "fsrs_card" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"exercise_id" integer NOT NULL,
	"state_blob" jsonb NOT NULL,
	"next_due_at" timestamp NOT NULL,
	CONSTRAINT "fsrscard_userid_exerciseid_uq" UNIQUE("user_id","exercise_id")
);
--> statement-breakpoint
CREATE TABLE "fsrs_review_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"fsrs_card_id" integer NOT NULL,
	"reviewed_at" timestamp NOT NULL,
	"rating" "fsrs_rating" NOT NULL,
	"state_blob" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fsrs_card" ADD CONSTRAINT "fsrs_card_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fsrs_card" ADD CONSTRAINT "fsrs_card_exercise_id_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fsrs_review_log" ADD CONSTRAINT "fsrs_review_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fsrs_review_log" ADD CONSTRAINT "fsrs_review_log_fsrs_card_id_fsrs_card_id_fk" FOREIGN KEY ("fsrs_card_id") REFERENCES "public"."fsrs_card"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fsrscard_userid_nextdueat_idx" ON "fsrs_card" USING btree ("user_id","next_due_at");--> statement-breakpoint
CREATE INDEX "fsrsreviewlog_userid_reviewedat_idx" ON "fsrs_review_log" USING btree ("user_id","reviewed_at");--> statement-breakpoint
CREATE INDEX "fsrsreviewlog_fsrscardid_reviewedat_idx" ON "fsrs_review_log" USING btree ("fsrs_card_id","reviewed_at");