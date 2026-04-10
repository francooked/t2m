CREATE TYPE "public"."language" AS ENUM('en', 'es');--> statement-breakpoint
CREATE TYPE "public"."message_role" AS ENUM('assistant', 'user');--> statement-breakpoint
CREATE TABLE "chat" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"target_language" "language" NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "correction" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" integer NOT NULL,
	"start" integer NOT NULL,
	"end" integer NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message" (
	"id" serial PRIMARY KEY NOT NULL,
	"chat_id" integer NOT NULL,
	"source" "message_role" NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suggestion" (
	"id" serial PRIMARY KEY NOT NULL,
	"correction_id" integer NOT NULL,
	"suggestion" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"native_language" "language" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat" ADD CONSTRAINT "chat_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correction" ADD CONSTRAINT "correction_message_id_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_chat_id_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggestion" ADD CONSTRAINT "suggestion_correction_id_correction_id_fk" FOREIGN KEY ("correction_id") REFERENCES "public"."correction"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_userid_idx" ON "chat" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "correction_messageid_idx" ON "correction" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "message_chatid_idx" ON "message" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "suggestion_correctionid_idx" ON "suggestion" USING btree ("correction_id");