<script lang="ts">
	import { enhance } from '$app/forms';
	import { LANGUAGE_CODE_LABELS, LANGUAGE_CODES } from '$lib/constants';
	import { createFormView } from '$lib/forms/create-form-view.svelte';
	import { DELETE_CHAT_ID, deleteChatFailure, deleteChatSuccess } from '$lib/forms/delete-chat';
	import { START_CHAT_ID, startChatFailure, startChatSuccess } from '$lib/forms/start-chat';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let startChat = createFormView({
		id: START_CHAT_ID,
		success: startChatSuccess,
		failure: startChatFailure,
		getForm: () => form
	});

	let deleteChat = createFormView({
		id: DELETE_CHAT_ID,
		success: deleteChatSuccess,
		failure: deleteChatFailure,
		getForm: () => form
	});
</script>

<h1>Chats</h1>

{#if deleteChat.view.status === 'failure'}
	<p>Error al eliminar</p>
{/if}

{#each data.chats as chat (chat.id)}
	<div class="row">
		<a href={`/chats/${chat.id}`} title={chat.title}>{chat.title}</a>
		<form method="post" action="?/deleteChat" use:enhance={deleteChat.enhance}>
			<button type="submit" disabled={deleteChat.view.status === 'pending'}>
				{deleteChat.view.status === 'pending' ? 'Cargando' : 'Eliminar'}
			</button>
			<input type="hidden" name="chat_id" value={chat.id} />
		</form>
	</div>
{:else}
	<p class="empty">Todavía no has iniciado ninguna conversación.</p>
{/each}

<form method="post" action="?/startChat" class="composer" use:enhance={startChat.enhance}>
	{#if startChat.view.status === 'failure'}
		<p>Error al iniciar el chat</p>
	{/if}
	<h2>Nueva conversación</h2>
	<label for="start_chat_content">Mensaje</label>
	<textarea id="start_chat_content" name="content" placeholder="¿Por dónde partimos?"></textarea>
	<div class="composer-row">
		<div>
			<label for="start_chat_language">Idioma</label>
			<select id="start_chat_language" name="target_language">
				{#each LANGUAGE_CODES as languageCode (languageCode)}
					{#if data.signedInUser.nativeLanguage !== languageCode}
						<option value={languageCode}>{LANGUAGE_CODE_LABELS.es[languageCode]}</option>
					{/if}
				{/each}
			</select>
		</div>
		<button type="submit" disabled={startChat.view.status === 'pending'}>
			{startChat.view.status === 'pending' ? 'Cargando' : 'Enviar'}
		</button>
	</div>
</form>

<style>
	.row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.9rem 0;
		border-bottom: 1px solid var(--wash);
	}

	.row a {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.row button {
		background: none;
		color: var(--muted);
		border: none;
		padding: 0;
		text-decoration: underline;
		text-underline-offset: 0.18em;
		flex-shrink: 0;
	}

	.row button:hover:not(:disabled) {
		color: var(--ink);
		background: none;
	}

	.empty {
		color: var(--muted);
		padding: 1.5rem 0;
	}

	.composer {
		margin-top: 2rem;
		padding-top: 0.35rem;
		border-top: 1px solid var(--line);
	}

	.composer h2 {
		margin-top: 0.85rem;
	}

	.composer-row {
		display: flex;
		align-items: flex-end;
		gap: 0.85rem;
	}

	.composer-row > div {
		flex: 1;
	}

	.composer-row select {
		margin-bottom: 0;
	}

	.composer-row button {
		flex-shrink: 0;
		margin-bottom: 0.15rem;
	}
</style>
