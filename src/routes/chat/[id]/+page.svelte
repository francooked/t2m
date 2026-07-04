<script lang="ts">
	import type { PageProps } from './$types';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from './$types';
	import { diffWords } from 'diff';
	import { invalidateAll } from '$app/navigation';

	const { data, params }: PageProps = $props();
	let isPageLoading = $state(false);

	const messages = $derived(
		data.messages.map((message) => {
			if (message.role === 'assistant') return message;

			let changes = new Array<{ added: boolean; removed: boolean; value: string }>();
			const lastMessageRewrite = message.messageRewrites.at(-1);

			if (lastMessageRewrite) {
				const changeObjects = diffWords(message.content, lastMessageRewrite.text);
				changes = changeObjects.map(({ added, removed, value }) => ({ added, removed, value }));
			}

			return { ...message, changes };
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

	$effect(() => {
		const statuses = new Set(['pending', 'generating', 'correcting']);
		if (!data.messages.some(({ status }) => statuses.has(status))) return;
		console.log('Yeah');
		const interval = setInterval(async () => {
			isPageLoading = true;
			await invalidateAll();
			isPageLoading = false;
		}, 1000);
		return () => clearInterval(interval);
	});
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
							<span class="text-red-400 line-through">{change.value}</span>
						{:else if change.added}
							<span class="text-green-400">{change.value}</span>
						{:else}
							<span class="">{change.value}</span>
						{/if}
					{:else}
						<span>{message.content}</span>
					{/each}
				{/if}
			</div>
		{/if}
	{/each}
</div>

<form method="post" action="?/reply" class="p-2" use:enhance={handleReply}>
	<textarea placeholder="¿Cuál es tu respuesta?" name="content"></textarea>
	<button type="submit" class="font-medium">Enviar</button>
	<input type="hidden" name="chat_id" value={params.id} />
</form>
