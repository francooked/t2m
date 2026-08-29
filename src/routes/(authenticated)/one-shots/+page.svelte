<script lang="ts">
	import { enhance } from '$app/forms';
	import { LANGUAGE_CODE_LABELS, LANGUAGE_CODES } from '$lib/constants';
	import {
		CORRECT_ONE_SHOT_ID,
		correctOneShotFailure,
		correctOneShotSuccess
	} from '$lib/forms/correct-one-shot';
	import { createFormView } from '$lib/forms/create-form-view.svelte';
	import { Popover } from 'melt/builders';
	import type { PageProps } from './$types';
	import { mergeAttrs } from 'melt';
	import {
		RETRY_ONE_SHOT_CORRECTION_ID,
		retryOneShotCorrectionFailure,
		retryOneShotCorrectionSuccess
	} from '$lib/forms/retry-one-shot-correction';

	const { data, form }: PageProps = $props();

	const correctOneShot = createFormView({
		id: CORRECT_ONE_SHOT_ID,
		success: correctOneShotSuccess,
		failure: correctOneShotFailure,
		getForm: () => form
	});

	let retryOneShotCorrection = createFormView({
		id: RETRY_ONE_SHOT_CORRECTION_ID,
		success: retryOneShotCorrectionSuccess,
		failure: retryOneShotCorrectionFailure,
		getForm: () => form
	});

	const popover = new Popover();
	let triggerData = $state<{ reason: string } | null>();
</script>

<h1>One-shots</h1>

<div>
	{#each data.chats as chat (chat.id)}
		<div>
			<span>({LANGUAGE_CODE_LABELS.es[chat.targetLanguage]})</span>
			{#if chat.message.status === 'complete'}
				{#each chat.message.rewriteHistory as change, index (index)}
					{#if change.kind === 'removed'}
						{#if change.text.trim() === ''}
							<span>{change.text}</span>
						{:else}
							<button
								type="button"
								class="text-red-400 line-through"
								{...mergeAttrs(popover.trigger, {
									onclick: () => (triggerData = { reason: change.reason })
								})}
							>
								{change.text}
							</button>
							<!-- 
							Add a space after a removed chunk if the next difference also starts with a word/number character,
							so that deleted tokens don't merge with new/untouched ones visually. 
							-->
							{#if /[\p{L}\p{N}]+/gu.test(chat.message.rewriteHistory.at(index + 1)?.text ?? '')}
								<span>{' '}</span>
							{/if}
						{/if}
					{:else if change.kind === 'added'}
						{#if change.text.trim() === ''}
							<span>{change.text}</span>
						{:else}
							<button
								type="button"
								class="text-green-400"
								{...mergeAttrs(popover.trigger, {
									onclick: () => (triggerData = { reason: change.reason })
								})}
							>
								{change.text}
							</button>
						{/if}
					{:else}
						<span>{change.text}</span>
					{/if}
				{:else}
					<span>{chat.message.content}</span>
				{/each}
			{:else if chat.message.status === 'correcting'}
				<span>Corrigiendo</span>
			{:else if chat.message.status === 'pending'}
				<span>Pendiente</span>
			{:else}
				<span>{chat.message.content}</span>
			{/if}

			{#if chat.message.status === 'failed'}
				<form method="post" action="?/retryCorrection" use:enhance={retryOneShotCorrection.enhance}>
					{#if retryOneShotCorrection.view.status === 'failure'}
						<p>Error al reintentar</p>
					{/if}

					<button type="submit" disabled={retryOneShotCorrection.view.status === 'pending'}>
						{retryOneShotCorrection.view.status === 'pending' ? 'Cargando' : 'Reintentar'}
					</button>
					<input type="hidden" name="chat_id" value={chat.id} />
					<input type="hidden" name="message_id" value={chat.message.id} />
				</form>
			{/if}
		</div>
	{/each}
</div>

<div
	{...mergeAttrs(popover.content, {
		class: triggerData ? 'reason visible' : 'reason'
	})}
>
	{#if triggerData}
		Corrección: {triggerData.reason}
	{/if}
</div>

<form method="post" action="?/correct" use:enhance={correctOneShot.enhance}>
	{#if correctOneShot.view.status === 'failure'}
		<p>Error al enviar</p>
	{/if}
	<textarea name="intent" placeholder="¿Qué quieres expresar?"></textarea>
	<textarea name="content" placeholder="¿Cómo lo quieres expresar?"></textarea>
	<select id="start_chat_language" name="target_language">
		{#each LANGUAGE_CODES as languageCode (languageCode)}
			{#if data.signedInUser.nativeLanguage !== languageCode}
				<option value={languageCode}>{LANGUAGE_CODE_LABELS.es[languageCode]}</option>
			{/if}
		{/each}
	</select>
	<button type="submit" disabled={correctOneShot.view.status === 'pending'}>
		{correctOneShot.view.status === 'pending' ? 'Cargando' : 'Enviar'}
	</button>
</form>
