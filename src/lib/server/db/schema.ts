import {
	pgTable,
	serial,
	integer,
	text,
	pgEnum,
	timestamp,
	index,
	jsonb
} from 'drizzle-orm/pg-core';
import { user } from './auth.schema';
import { EXERCISE_TYPES, LANGUAGES, MESSAGE_STATUS, ROLES, SRS_ALGORITHMS } from '$lib/constants';
import { isNull } from 'drizzle-orm';

export const languageEnum = pgEnum('language', LANGUAGES);
export const messageRoleEnum = pgEnum('message_role', ROLES);
export const messageStatusEnum = pgEnum('message_status', MESSAGE_STATUS);
export const exerciseTypeEnum = pgEnum('exercise_type', EXERCISE_TYPES);
export const srsAlgorithmEnum = pgEnum('srs_algorithm', SRS_ALGORITHMS);

export const userProfile = pgTable('user_profile', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	nativeLanguage: languageEnum('native_language').notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at')
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull()
});

export const userSrsProfile = pgTable('user_srs_profile', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	algorithm: srsAlgorithmEnum('algorithm').notNull(),
	setup: jsonb('setup').notNull()
});

export const chat = pgTable(
	'chat',
	{
		id: serial('id').primaryKey(),
		userId: text('user_id')
			.references(() => user.id, { onDelete: 'cascade' })
			.notNull(),
		targetLanguage: languageEnum('target_language').notNull(),
		title: text('title').notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [index('chat_userid_idx').on(table.userId)]
);

export const message = pgTable(
	'message',
	{
		id: serial('id').primaryKey(),
		chatId: integer('chat_id')
			.references(() => chat.id, { onDelete: 'cascade' })
			.notNull(),
		role: messageRoleEnum('role').notNull(),
		content: text('content').notNull(),
		status: messageStatusEnum('status').notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => [index('message_chatid_idx').on(table.chatId)]
);

export const correction = pgTable(
	'correction',
	{
		id: serial('id').primaryKey(),
		messageId: integer('message_id')
			.references(() => message.id, { onDelete: 'cascade' })
			.notNull(),
		start: integer('start').notNull(),
		end: integer('end').notNull(),
		reason: text('reason').notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => [index('correction_messageid_idx').on(table.messageId)]
);

export const suggestion = pgTable(
	'suggestion',
	{
		id: serial('id').primaryKey(),
		correctionId: integer('correction_id')
			.references(() => correction.id, { onDelete: 'cascade' })
			.notNull(),
		replacement: text('suggestion').notNull()
	},
	(table) => [index('suggestion_correctionid_idx').on(table.correctionId)]
);

export const exercise = pgTable(
	'exercise',
	{
		id: serial('id').primaryKey(),
		userId: text('user_id')
			.references(() => user.id, { onDelete: 'cascade' })
			.notNull(),
		type: exerciseTypeEnum('type').notNull(),
		source: jsonb('source').$type<{ type: 'correction'; correctionId: number }>().notNull(),
		payload: jsonb('payload')
			.$type<{ version: number } & { type: 'full_answer'; front: string; back: string }>()
			.notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		archivedAt: timestamp('archived_at')
	},
	(table) => [
		index('exercise_userid_createdat_desc_idx').on(table.userId, table.createdAt.desc()),
		index('exercise_userid_createdat_desc_active_idx')
			.on(table.userId, table.createdAt.desc())
			.where(isNull(table.archivedAt))
	]
);
