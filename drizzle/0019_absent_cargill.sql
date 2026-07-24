CREATE TABLE "exercise_message_rewrite" (
	"exercise_id" integer NOT NULL,
	"message_rewrite_id" integer NOT NULL,
	CONSTRAINT "exercise_message_rewrite_exercise_id_message_rewrite_id_pk" PRIMARY KEY("exercise_id","message_rewrite_id")
);
--> statement-breakpoint
ALTER TABLE "exercise_message_rewrite" ADD CONSTRAINT "exercise_message_rewrite_exercise_id_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_message_rewrite" ADD CONSTRAINT "exercise_message_rewrite_message_rewrite_id_message_rewrite_id_fk" FOREIGN KEY ("message_rewrite_id") REFERENCES "public"."message_rewrite"("id") ON DELETE cascade ON UPDATE no action;