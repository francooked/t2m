import { pgTable, serial, integer, text, pgEnum, timestamp, index } from 'drizzle-orm/pg-core';
import { user } from './auth.schema';
import { LANGUAGES, MESSAGE_STATUS, ROLES } from '$lib/constants';

export const languageEnum = pgEnum('language', LANGUAGES);
export const messageRoleEnum = pgEnum('message_role', ROLES);
export const messageStatusEnum = pgEnum('message_status', MESSAGE_STATUS);

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
