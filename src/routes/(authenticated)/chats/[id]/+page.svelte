<script lang="ts">
	import type { PageProps } from './$types';
	import { enhance } from '$app/forms';
	import { Popover } from 'melt/builders';
	import { mergeAttrs } from 'melt';
	import { createFormView } from '$lib/forms/create-form-view.svelte';
	import {
		REPLY_AND_CORRECT_ID,
		replyAndCorrectFailure,
		replyAndCorrectSuccess
	} from '$lib/forms/reply-and-correct';
	import { RETRY_REPLY_ID, retryReplyFailure, retryReplySuccess } from '$lib/forms/retry-reply';
	import {
		RETRY_CORRECTION_ID,
		retryCorrectionFailure,
		retryCorrectionSuccess
	} from '$lib/forms/retry-correction';

	const { data, form }: PageProps = $props();
	const popover = new Popover();
	let triggerData = $state<{ reason: string } | null>();

	let replyAndCorrect = createFormView({
		id: REPLY_AND_CORRECT_ID,
		success: replyAndCorrectSuccess,
		failure: replyAndCorrectFailure,
		getForm: () => form
	});

	let retryReply = createFormView({
		id: RETRY_REPLY_ID,
		success: retryReplySuccess,
		failure: retryReplyFailure,
		getForm: () => form
	});

	let retryCorrection = createFormView({
		id: RETRY_CORRECTION_ID,
		success: retryCorrectionSuccess,
		failure: retryCorrectionFailure,
		getForm: () => form
	});
</script>

<p class="back"><a href="/chats">← Chats</a></p>
<h1>Mensajes</h1>

<div class="thread">
	{#each data.messages as message (message.id)}
		{#if message.role === 'assistant'}
			<div class="msg">
				<p class="who">Asistente</p>
				<p>
					{#if message.status === 'complete'}
						{message.content}
					{:else if message.status === 'failed'}
						Error al generar la respuesta
					{/if}
				</p>

				{#if message.status === 'failed'}
					<form method="post" action="?/retryReply" use:enhance={retryReply.enhance}>
						{#if retryReply.view.status === 'failure'}
							<p>Error al reintentar</p>
						{/if}
						<button type="submit" disabled={retryReply.view.status === 'pending'}>
							{retryReply.view.status === 'pending' ? 'Cargando' : 'Reintentar'}
						</button>
						<input type="hidden" name="message_id" value={message.id} />
					</form>
				{/if}
			</div>
		{:else}
			<div class="msg">
				<p class="who">
					Tú
					{#if message.status === 'correcting'}
						<span class="status">(Corrigiendo)</span>
					{:else if message.status === 'failed'}
						<span class="status">(Error)</span>
					{:else if message.status === 'pending'}
						<span class="status">(Pendiente)</span>
					{/if}
				</p>

				<p>
					{#if message.status === 'complete'}
						{#each message.rewriteHistory as change, index (index)}
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
									{#if /[\p{L}\p{N}]+/gu.test(message.rewriteHistory.at(index + 1)?.text ?? '')}
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
							<span>{message.content}</span>
						{/each}
					{:else}
						<span>{message.content}</span>
					{/if}
				</p>

				{#if message.status === 'failed'}
					<form method="post" action="?/retryCorrection" use:enhance={retryCorrection.enhance}>
						{#if retryCorrection.view.status === 'failure'}
							<p>Error al reintentar</p>
						{/if}
						<button type="submit" disabled={retryCorrection.view.status === 'pending'}>
							{retryCorrection.view.status === 'pending' ? 'Cargando' : 'Reintentar'}
						</button>
						<input type="hidden" name="message_id" value={message.id} />
					</form>
				{/if}
			</div>
		{/if}
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

<form method="post" action="?/replyAndCorrect" class="composer" use:enhance={replyAndCorrect.enhance}>
	{#if replyAndCorrect.view.status === 'failure'}
		<p>Error al enviar</p>
	{/if}
	<label for="reply_content">Respuesta</label>
	<textarea id="reply_content" placeholder="¿Cuál es tu respuesta?" name="content"></textarea>
	<button type="submit" disabled={replyAndCorrect.view.status === 'pending'}>
		{replyAndCorrect.view.status === 'pending' ? 'Cargando' : 'Enviar'}
	</button>
</form>

<h2>Ejercicios generados</h2>
<ul>
	{#each data.exercises as exercise (exercise.id)}
		{#if exercise.type === 'full_answer' && exercise.version === 1}
			<li>
				<span class="wrong">✕ {exercise.payload.front}</span>
				<span class="right">✓ {exercise.payload.back}</span>
			</li>
		{/if}
	{/each}
</ul>

<style>
	.back {
		margin: 0 0 0.65rem;
		font-size: 0.85rem;
	}

	.back a {
		color: var(--muted);
	}

	.thread {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		margin-bottom: 1.5rem;
	}

	.msg p {
		margin: 0;
	}

	.who {
		font-size: 0.7rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted);
		margin-bottom: 0.3rem;
		font-weight: 600;
	}

	.status {
		font-weight: 400;
		text-transform: none;
		letter-spacing: 0;
		margin-left: 0.35rem;
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

	.composer {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		margin-top: 0.5rem;
		padding-top: 1.15rem;
		border-top: 1px solid var(--line);
	}

	.composer textarea {
		width: 100%;
	}

	.wrong {
		display: block;
		color: var(--muted);
		text-decoration: line-through;
	}

	.right {
		display: block;
		margin-top: 0.15rem;
	}

	li {
		padding: 0.7rem 0;
	}
</style>
