import {
	pgTable,
	serial,
	integer,
	text,
	pgEnum,
	timestamp,
	index,
	jsonb,
	unique
} from 'drizzle-orm/pg-core';
import { user } from './auth.schema';
import { exercise } from './schema';
import { FSRS_RATINGS } from '$lib/constants';
import { type Card, type ReviewLog } from 'ts-fsrs';

export const fsrsRatingEnum = pgEnum('fsrs_rating', FSRS_RATINGS);

export const fsrsCard = pgTable(
	'fsrs_card',
	{
		id: serial('id').primaryKey(),
		userId: text('user_id')
			.references(() => user.id, { onDelete: 'cascade' })
			.notNull(),
		exerciseId: integer('exercise_id')
			.references(() => exercise.id, { onDelete: 'cascade' })
			.notNull(),
		stateBlob: jsonb('state_blob').$type<Card>().notNull(),
		nextDueAt: timestamp('next_due_at').notNull()
	},
	(table) => [
		unique('fsrscard_userid_exerciseid_uq').on(table.userId, table.exerciseId),
		index('fsrscard_userid_nextdueat_desc_idx').on(table.userId, table.nextDueAt.desc())
	]
);

export const fsrsReviewLog = pgTable(
	'fsrs_review_log',
	{
		id: serial('id').primaryKey(),
		userId: text('user_id')
			.references(() => user.id, { onDelete: 'cascade' })
			.notNull(),
		fsrsCardId: integer('fsrs_card_id')
			.references(() => fsrsCard.id, { onDelete: 'cascade' })
			.notNull(),
		reviewedAt: timestamp('reviewed_at').notNull(),
		rating: fsrsRatingEnum('rating').notNull(),
		stateBlob: jsonb('state_blob').$type<ReviewLog>().notNull()
	},
	(table) => [
		index('fsrsreviewlog_userid_reviewedat_idx').on(table.userId, table.reviewedAt),
		index('fsrsreviewlog_fsrscardid_reviewedat_idx').on(table.fsrsCardId, table.reviewedAt)
	]
);
