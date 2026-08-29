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

<h1>Correcciones rápidas</h1>

<div class="thread">
	{#each data.chats as chat (chat.id)}
		<div class="shot">
			<p class="who">{LANGUAGE_CODE_LABELS.es[chat.targetLanguage]}</p>

			<p>
				{#if chat.message.status === 'complete'}
					{#each chat.message.rewriteHistory as change, index (index)}
						{#if change.kind === 'removed'}
							{#if change.text.trim() === ''}
								<span>{change.text}</span>
							{:else}
								<button
									type="button"
									class="corr-rm"
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
									class="corr-add"
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
				{:else}
					<span>{chat.message.content}</span>
				{/if}
			</p>

			{#if chat.message.status === 'correcting' || chat.message.status === 'pending'}
				<p class="note">Generando corrección…</p>
			{:else if chat.message.status === 'failed'}
				<form
					class="retry"
					method="post"
					action="?/retryCorrection"
					use:enhance={retryOneShotCorrection.enhance}
				>
					{#if retryOneShotCorrection.view.status === 'pending'}
						Generando corrección…
					{:else}
						<span>No se pudo generar la corrección.</span>
						<button type="submit">Reintentar</button>
					{/if}
					<input type="hidden" name="chat_id" value={chat.id} />
					<input type="hidden" name="message_id" value={chat.message.id} />
				</form>
			{/if}
		</div>
	{:else}
		<p class="empty">Todavía no has corregido ninguna oración.</p>
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

<form method="post" action="?/correct" class="composer" use:enhance={correctOneShot.enhance}>
	{#if correctOneShot.view.status === 'failure'}
		<p>Error al enviar</p>
	{/if}
	<h2>Nueva corrección</h2>
	<label for="one_shot_intent">Intención</label>
	<textarea id="one_shot_intent" name="intent" placeholder="¿Qué quieres expresar?"></textarea>
	<label for="one_shot_content">Texto</label>
	<textarea id="one_shot_content" name="content" placeholder="¿Cómo lo quieres expresar?"
	></textarea>
	<div class="composer-row">
		<div>
			<label for="one_shot_language">Idioma</label>
			<select id="one_shot_language" name="target_language">
				{#each LANGUAGE_CODES as languageCode (languageCode)}
					{#if data.signedInUser.nativeLanguage !== languageCode}
						<option value={languageCode}>{LANGUAGE_CODE_LABELS.es[languageCode]}</option>
					{/if}
				{/each}
			</select>
		</div>
		<button type="submit" disabled={correctOneShot.view.status === 'pending'}>
			{correctOneShot.view.status === 'pending' ? 'Cargando' : 'Enviar'}
		</button>
	</div>
</form>

<style>
	.thread {
		margin-bottom: 1.5rem;
	}

	.shot {
		padding: 0.9rem 0;
		border-bottom: 1px solid var(--wash);
	}

	.shot:first-child {
		padding-top: 0;
	}

	.shot:last-child {
		border-bottom: 0;
	}

	.shot p {
		margin: 0;
	}

	.shot .note,
	.shot .retry {
		margin-top: 0.3rem;
	}

	.who {
		font-size: 0.7rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted);
		margin: 0 0 0.3rem;
		font-weight: 600;
	}

	.note,
	.retry {
		margin: 0.3rem 0 0;
		font-size: 0.85rem;
		color: var(--muted);
	}

	.retry button {
		background: none;
		color: var(--muted);
		border: none;
		padding: 0;
		font: inherit;
		text-decoration: underline;
		text-underline-offset: 0.18em;
	}

	.retry button:hover:not(:disabled) {
		color: var(--ink);
		background: none;
	}

	.corr-rm,
	.corr-add {
		font: inherit;
		padding: 0;
		background: none;
		border: none;
		cursor: pointer;
	}

	.corr-rm {
		text-decoration: line-through;
		color: var(--muted);
		text-decoration-thickness: 1px;
		box-shadow: inset 0 -1px 0 var(--line);
	}

	.corr-add {
		font-weight: 600;
		text-decoration: none;
		box-shadow: inset 0 -1px 0 var(--ink);
	}

	.reason.visible {
		padding: 0.65rem 0.8rem;
		background: var(--wash);
		font-size: 0.85rem;
		max-width: 18rem;
	}

	.empty {
		color: var(--muted);
		padding: 0.25rem 0;
	}

	.composer {
		margin-top: 0.5rem;
		padding-top: 1.15rem;
		border-top: 1px solid var(--line);
	}

	.composer h2 {
		margin-top: 0;
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
