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

<div class="p-2">
	<h1 class="font-bold underline">Chats</h1>
	{#if deleteChat.view.status === 'failure'}
		<p>Error al eliminar</p>
	{/if}
	{#each data.chats as chat (chat.id)}
		<div>
			<a href={`/chats/${chat.id}`} class="font-medium">{chat.title}</a>
			<form method="post" action="?/deleteChat" class="inline" use:enhance={deleteChat.enhance}>
				<button type="submit" class="font-medium" disabled={deleteChat.view.status === 'pending'}
					>{deleteChat.view.status === 'pending' ? 'Cargando' : 'Eliminar'}</button
				>
				<input type="hidden" name="chat_id" value={chat.id} />
			</form>
		</div>
	{:else}
		<p>Todavía no has iniciado ninguna conversación.</p>
	{/each}
</div>

<form method="post" action="?/startChat" class="p-2" use:enhance={startChat.enhance}>
	{#if startChat.view.status === 'failure'}
		<p>Error al iniciar el chat</p>
	{/if}
	<textarea name="content" placeholder="¿Por dónde partimos?"></textarea>
	<select name="target_language">
		{#each LANGUAGE_CODES as languageCode (languageCode)}
			{#if data.signedInUser.nativeLanguage !== languageCode}
				<option value={languageCode}>{LANGUAGE_CODE_LABELS.es[languageCode]}</option>
			{/if}
		{/each}
	</select>
	<button type="submit" class="font-medium" disabled={startChat.view.status === 'pending'}
		>{startChat.view.status === 'pending' ? 'Cargando' : 'Enviar'}</button
	>
</form>
