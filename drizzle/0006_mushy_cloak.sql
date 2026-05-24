DROP INDEX "fsrscard_userid_nextdueat_idx";--> statement-breakpoint
CREATE INDEX "fsrscard_userid_nextdueat_desc_idx" ON "fsrs_card" USING btree ("user_id","next_due_at" DESC NULLS LAST);