ALTER TABLE "user" ADD COLUMN "native_language" text NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "time_zone" text NOT NULL;--> statement-breakpoint
CREATE INDEX "feedback_userId_idx" ON "feedback" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "exercise" DROP COLUMN "source";