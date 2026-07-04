ALTER TABLE "rewrite_change" RENAME COLUMN "rewrite_id" TO "message_rewrite_id";--> statement-breakpoint
ALTER TABLE "rewrite_change" DROP CONSTRAINT "rewrite_change_rewrite_id_message_rewrite_id_fk";
--> statement-breakpoint
ALTER TABLE "rewrite_change" ADD CONSTRAINT "rewrite_change_message_rewrite_id_message_rewrite_id_fk" FOREIGN KEY ("message_rewrite_id") REFERENCES "public"."message_rewrite"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "messagerewrite_messageid_idx" ON "message_rewrite" USING btree ("message_id");