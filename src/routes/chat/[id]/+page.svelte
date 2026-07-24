<script lang="ts">
	import type { PageProps } from './$types';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from './$types';
	import { Popover } from 'melt/builders';
	import { mergeAttrs } from 'melt';

	const { data, params }: PageProps = $props();
	const popover = new Popover();
	let submitting = $state(false);
	let triggerData = $state<{ reason: string } | null>();

	const handleReplyAndCorrect: SubmitFunction = async () => {
		submitting = true;
		return async ({ result, update }) => {
			if (result.type === 'failure' || result.type === 'error') {
				console.error('retry reply failed:', result);
			} else {
				await update();
			}
			submitting = false;
		};
	};
</script>

<div class="p-2">
	<h1 class="font-bold underline">Mensajes</h1>
	{#each data.messages as message (message.id)}
		{#if message.role === 'assistant'}
			<div>
				<span class="">Asistente:</span>
				<span>
					{#if message.status === 'complete'}
						{message.content}
					{:else if message.status === 'failed'}
						Error al generar la respuesta
					{/if}
				</span>

				{#if message.status === 'failed'}
					<form method="post" action="?/retryReply">
						<button type="submit" class="font-medium">Reintentar</button>
						<input type="hidden" name="chat_id" value={params.id} />
						<input type="hidden" name="message_id" value={message.id} />
					</form>
				{/if}
			</div>
		{:else}
			<div>
				<span class="">Tú:</span>

				{#if message.status === 'correcting'}
					<span class="text-gray-400">(Corrigiendo)</span>
				{:else if message.status === 'failed'}
					<span class="text-red-400">(Error)</span>
				{:else if message.status === 'pending'}
					<span class="text-blue-400">(Pendiente)</span>
				{/if}

				{#if message.status === 'complete'}
					{#each message.rewriteHistory as change, index}
						{#if change.kind === 'removed'}
							{#if change.text.trim() === ''}
								<span>{change.text}</span>
							{:else}
								<button
									class="text-red-400 line-through"
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
									class=" text-green-400"
									{...mergeAttrs(popover.trigger, {
										onclick: () => (triggerData = { reason: change.reason })
									})}
								>
									{change.text}
								</button>
							{/if}
						{:else}
							<span class="">{change.text}</span>
						{/if}
					{:else}
						<span>{message.content}</span>
					{/each}
				{:else}
					<span>{message.content}</span>
				{/if}

				{#if message.status === 'failed'}
					<form method="post" action="?/retryCorrection">
						<button type="submit" class="font-medium">Reintentar</button>
						<input type="hidden" name="chat_id" value={params.id} />
						<input type="hidden" name="message_id" value={message.id} />
					</form>
				{/if}
			</div>
		{/if}
	{/each}
</div>

<div {...popover.content}>
	{#if triggerData}
		Corrección: {triggerData.reason}
	{/if}
</div>

<form method="post" action="?/replyAndCorrect" class="p-2" use:enhance={handleReplyAndCorrect}>
	<textarea placeholder="¿Cuál es tu respuesta?" name="content"></textarea>
	<button type="submit" class="font-medium" disabled={submitting}
		>{submitting ? 'Enviando' : 'Enviar'}</button
	>
	<input type="hidden" name="chat_id" value={params.id} />
</form>

<h1 class="font-bold underline">Ejercicios generados</h1>
<ul>
	{#each data.exercises as exercise}
		{#if exercise.type === 'full_answer' && exercise.version === 1}
			<li>
				✕ {exercise.payload.front}<br />
				✓ {exercise.payload.back}
			</li>
		{/if}
	{/each}
</ul>
