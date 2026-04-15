<script lang="ts">
	import type { PageProps } from './$types';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from './$types';
	import type { StreamEvent } from '$lib/server/stream-events';
	import { parseNdjson } from '$lib/utils';
	import { segmentMessageByCorrections } from '$lib/message-tokens';
	import { invalidateAll } from '$app/navigation';

	const { data, params }: PageProps = $props();

	const messages = $derived(
		data.messages.map((message) =>
			message.role === 'assistant'
				? message
				: { ...message, tokens: segmentMessageByCorrections(message.content, message.corrections) }
		)
	);

	let assistantStream: HTMLSpanElement | null = $state(null);

	$effect(() => {
		const controller = new AbortController();
		const lastMessage = data.messages.at(-1);
		if (
			lastMessage &&
			lastMessage.role === 'assistant' &&
			(lastMessage.status === 'pending' || lastMessage.status === 'generating')
		) {
			(async () => {
				const response = await fetch('/api/stream/reply', {
					method: 'post',
					body: JSON.stringify({
						chatId: params.id,
						messageId: data.messages[data.messages.length - 1].id
					}),
					signal: controller.signal
				});
				if (!response.body) {
					console.log('No body.');
					return;
				}

				let fullContent = '';
				const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
				while (true) {
					const { value, done } = await reader.read();
					if (done) {
						break;
					}
					if (!value) {
						break;
					}

					const streamEvents = parseNdjson<StreamEvent>(value);
					if (!streamEvents) break;

					for (const streamEvent of streamEvents) {
						if (streamEvent.type === 'chunk' && streamEvent.content && assistantStream) {
							fullContent += streamEvent.content;
							assistantStream.innerHTML = fullContent;
						}
					}
				}
			})();
		}

		return () => controller.abort();
	});

	$effect(() => {
		const controller = new AbortController();
		const lastMessage = data.messages.at(-2);
		if (
			lastMessage &&
			lastMessage.role === 'user' &&
			(lastMessage.status === 'pending' || lastMessage.status === 'correcting')
		) {
			(async () => {
				const response = await fetch('/api/stream/correct', {
					method: 'post',
					body: JSON.stringify({ chatId: params.id, messageId: lastMessage.id }),
					signal: controller.signal
				});
				if (!response.body) {
					console.log('No body.');
					return;
				}

				const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
				while (true) {
					const { value, done } = await reader.read();
					if (done) {
						break;
					}
					if (!value) {
						break;
					}

					const streamEvents = parseNdjson<StreamEvent>(value);
					if (!streamEvents) break;

					if (streamEvents.some(({ type }) => type === 'done')) break;
				}
				await invalidateAll();
			})();
		}

		return () => controller.abort();
	});

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
</script>

<div class="p-2">
	<h1 class="font-bold underline">Mensajes</h1>
	{#each messages as message}
		{#if message.role === 'assistant'}
			<div>
				<span class="">Asistente:</span>
				<span id="assistant_stream" bind:this={assistantStream}>
					{#if message.status === 'complete'}
						{message.content}
					{:else if message.status === 'failed'}
						Error al generar la respuesta
					{:else}
						Generando el mensaje...
					{/if}
				</span>
				{#if message.status === 'failed'}
					<form method="post" action="?/reply">
						<button type="submit" class="font-medium">Reintenar</button>
						<input type="hidden" name="chatId" value={params.id} />
					</form>
				{/if}
			</div>
		{:else}
			<div>
				<span class="">Tú:</span>
				{#each message.tokens as token}
					{#if token.type === 'text'}
						<span>{token.content}</span>
					{:else}
						<span class="text-red-400 line-through">{token.content}</span>
						<span class="text-green-400">{token.suggestions[0].replacement}</span>
					{/if}
				{/each}
			</div>
		{/if}
	{/each}
</div>

<form method="post" action="?/reply" class="p-2" use:enhance={handleReply}>
	<textarea placeholder="¿Cuál es tu respuesta?" name="content"></textarea>
	<button type="submit" class="font-medium">Enviar</button>
	<input type="hidden" name="chat_id" value={params.id} />
</form>
