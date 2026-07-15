<script lang="ts">
	import type { PageProps } from './$types';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from './$types';
	import { invalidateAll } from '$app/navigation';
	import { buildBlame, toGlobalSegments } from '$lib/correction/blame';
	import { Popover } from 'melt/builders';
	import { mergeAttrs } from 'melt';

	const { data, params }: PageProps = $props();
	let isPageLoading = $state(false);
	const popover = new Popover();
	let triggerData = $state<{ reason: string } | null>();

	const messages = $derived(
		data.messages.map((message) => {
			if (message.role === 'assistant') return message;

			const steps = message.messageRewrites
				.toSorted((a, b) => a.index - b.index)
				.map(({ text: sentence, reason }) => ({ reason, sentence }));
			const cells = buildBlame(message.content, steps);
			const segments = toGlobalSegments(cells, steps);

			return {
				id: message.id,
				role: message.role,
				status: message.status,
				content: message.content,
				changes: segments.map(({ kind, reason, step, text }) => ({
					added: kind === 'added',
					removed: kind === 'removed',
					value: text,
					reason
				}))
			};
		})
	);

	const handleReply: SubmitFunction = async () => {
		return async ({ result, update }) => {
			if (result.type === 'success') {
				console.log('success:', result.data);
				await update();
			} else if (result.type === 'error') {
				console.log('error:', result);
			}
		};
	};

	// $effect(() => {
	// 	const statuses = new Set(['pending', 'generating', 'correcting']);
	// 	if (!data.messages.some(({ status }) => statuses.has(status))) return;
	// 	console.log('Yeah');
	// 	const interval = setInterval(async () => {
	// 		isPageLoading = true;
	// 		await invalidateAll();
	// 		isPageLoading = false;
	// 	}, 1000);
	// 	return () => clearInterval(interval);
	// });

	$inspect(messages);
</script>

<div class="p-2">
	<h1 class="font-bold underline">
		Mensajes
		{#if isPageLoading}
			<span class="text-gray-400">(Refrescando)</span>
		{/if}
	</h1>
	{#each messages as message (message.id)}
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
					<form method="post" action="?/reply">
						<button type="submit" class="font-medium">Reintenar</button>
						<input type="hidden" name="chat_id" value={params.id} />
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
					{#each message.changes as change}
						{#if change.removed}
							<button
								class="text-red-400 line-through"
								{...mergeAttrs(popover.trigger, {
									onclick: () => (triggerData = { reason: change.reason })
								})}>{change.value}</button
							>
						{:else if change.added}
							<button
								class="text-green-400"
								{...mergeAttrs(popover.trigger, {
									onclick: () => (triggerData = { reason: change.reason })
								})}>{change.value}</button
							>
						{:else}
							<span class="">{change.value}</span>
						{/if}
					{:else}
						<span>{message.content}</span>
					{/each}
				{:else}
					<span>{message.content}</span>
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

<form method="post" action="?/reply" class="p-2" use:enhance={handleReply}>
	<textarea placeholder="¿Cuál es tu respuesta?" name="content"></textarea>
	<button type="submit" class="font-medium">Enviar</button>
	<input type="hidden" name="chat_id" value={params.id} />
</form>
