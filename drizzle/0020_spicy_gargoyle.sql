CREATE TABLE "exercise_check" (
	"id" serial PRIMARY KEY NOT NULL,
	"exercise_id" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"rated_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "exercise_check" ADD CONSTRAINT "exercise_check_exercise_id_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exercisecheck_id_createdat_desc_idx" ON "exercise_check" USING btree ("exercise_id","created_at" DESC NULLS LAST);