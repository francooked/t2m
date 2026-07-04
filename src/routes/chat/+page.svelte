<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { LANGUAGE_CODE_LABELS, LANGUAGE_CODES } from '$lib/constants';
	import type { PageProps, SubmitFunction } from './$types';

	let { data }: PageProps = $props();

	const handleStartChat: SubmitFunction = async () => {
		return async ({ result }) => {
			if (result.type === 'redirect') {
				goto(result.location);
			} else if (result.type === 'failure') {
				console.log('failure:', result);
			}
		};
	};

	const handleDeleteChat: SubmitFunction = async () => {
		return async ({ result, update }) => {
			if (result.type === 'success') {
				await update();
			} else if (result.type === 'error') {
				console.log('error:', result);
			}
		};
	};
</script>

<div class="p-2">
	<h1 class="font-bold underline">Chats</h1>
	{#each data.chats as chat}
		<div>
			<a href={`/chat/${chat.id}`} class="font-medium">{chat.title}</a>
			<form method="post" action="?/deleteChat" class="inline" use:enhance={handleDeleteChat}>
				<button type="submit" class="font-medium">Eliminar</button>
				<input type="hidden" name="chat_id" value={chat.id} />
			</form>
		</div>
	{:else}
		<p>Todavía no has iniciado ninguna conversación.</p>
	{/each}
</div>

<form method="post" action="?/startChat" class="p-2" use:enhance={handleStartChat}>
	<textarea name="content" placeholder="¿Por dónde partimos?"></textarea>
	<select name="target_language">
		{#each LANGUAGE_CODES as languageCode}
			{#if data.userProfile.nativeLanguage !== languageCode}
				<option value={languageCode}>{LANGUAGE_CODE_LABELS.es[languageCode]}</option>
			{/if}
		{/each}
	</select>
	<button type="submit" class="font-medium">Enviar</button>
</form>
