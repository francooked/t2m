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
import { isNull } from 'drizzle-orm';
import { user } from './auth.schema';
import {
	EXERCISE_TYPES,
	LANGUAGE_CODES,
	MESSAGE_STATUS,
	ROLES,
	SRS_ALGORITHMS,
	TIME_ZONES
} from '$lib/constants';
import type { ExercisePayload } from '$lib/exercise/exercise-payload';

export const languageCodeEnum = pgEnum('language_code', LANGUAGE_CODES);
export const messageRoleEnum = pgEnum('message_role', ROLES);
export const messageStatusEnum = pgEnum('message_status', MESSAGE_STATUS);
export const exerciseTypeEnum = pgEnum('exercise_type', EXERCISE_TYPES);
export const srsAlgorithmEnum = pgEnum('srs_algorithm', SRS_ALGORITHMS);
export const timeZoneEnum = pgEnum('time_zone', TIME_ZONES);

export const userProfile = pgTable('user_profile', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	nativeLanguage: languageCodeEnum('native_language').notNull(),
	timeZone: timeZoneEnum('time_zone').notNull(),
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
		targetLanguage: languageCodeEnum('target_language').notNull(),
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

export const messageRewrite = pgTable(
	'message_rewrite',
	{
		id: serial('id').primaryKey(),
		messageId: integer('message_id').references(() => message.id, { onDelete: 'cascade' }),
		text: text('text').notNull(),
		index: integer('index').notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => [index('messagerewrite_messageid_idx').on(table.messageId)]
);

export const exercise = pgTable(
	'exercise',
	{
		id: serial('id').primaryKey(),
		userId: text('user_id')
			.references(() => user.id, { onDelete: 'cascade' })
			.notNull(),
		targetLanguage: languageCodeEnum('target_language').notNull(),
		type: exerciseTypeEnum('type').notNull(),
		version: integer('version').notNull(),
		source: jsonb('source').$type<{ messageRewriteId: number }>().notNull(),
		payload: jsonb('payload').$type<ExercisePayload>().notNull(),
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
