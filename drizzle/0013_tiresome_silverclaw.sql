CREATE TABLE "message_rewrite" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" integer,
	"text" text NOT NULL,
	"index" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rewrite_change" (
	"id" serial PRIMARY KEY NOT NULL,
	"rewrite_id" integer,
	"sequence" integer NOT NULL,
	"removed" text,
	"added" text,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "message_rewrite" ADD CONSTRAINT "message_rewrite_message_id_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewrite_change" ADD CONSTRAINT "rewrite_change_rewrite_id_message_rewrite_id_fk" FOREIGN KEY ("rewrite_id") REFERENCES "public"."message_rewrite"("id") ON DELETE cascade ON UPDATE no action;