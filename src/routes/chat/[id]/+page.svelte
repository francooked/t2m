<script lang="ts">
	import type { PageProps } from './$types';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from './$types';
	import { segmentMessageByCorrections } from '$lib/message-tokens';
	import { CorrectStreamManager, ReplyStreamManager } from '$lib/stream-manager';
	import z from 'zod';

	const { data, params }: PageProps = $props();

	const replyStreamManager = new ReplyStreamManager();
	const correctStreamManager = new CorrectStreamManager();

	const messages = $derived(
		data.messages.map((message) =>
			message.role === 'assistant'
				? message
				: { ...message, tokens: segmentMessageByCorrections(message.content, message.corrections) }
		)
	);

	$effect(() => {
		const lastMessage = data.messages.at(-1);
		if (
			lastMessage &&
			lastMessage.role === 'assistant' &&
			(lastMessage.status === 'pending' || lastMessage.status === 'generating')
		) {
			replyStreamManager.start({ chatId: Number(params.id), messageId: lastMessage.id });
		}
	});

	$effect(() => {
		const lastMessage = data.messages.at(-2);
		if (
			lastMessage &&
			lastMessage.role === 'user' &&
			(lastMessage.status === 'pending' || lastMessage.status === 'correcting')
		) {
			correctStreamManager.start({ chatId: Number(params.id), messageId: lastMessage.id });
		}
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

	const llmJsonToCorrections = (content: string, llmJson: string) => {
		const zodSchema = z.array(
			z.object({
				fragment: z.string().min(1),
				reason: z.string().min(1),
				suggestions: z.array(z.object({ replacement: z.string().min(1) }))
			})
		);
		const { success, data } = zodSchema.safeParse(JSON.parse(llmJson));
		if (!success) {
			throw new Error('Invalid JSON response from LLM.');
		}
		return data.map(({ fragment, reason, suggestions }) => {
			const start = content.indexOf(fragment);
			const end = start + fragment.length - 1;
			return {
				id: new Date().getDate(),
				reason,
				start,
				end,
				suggestions
			};
		});
	};
</script>

<div class="p-2">
	<h1 class="font-bold underline">Mensajes</h1>
	{#each messages as message (message.id)}
		{#if message.role === 'assistant'}
			<div>
				<span class="">Asistente:</span>
				<span>
					{#if message.status === 'complete'}
						{message.content}
					{:else if message.status === 'failed'}
						Error al generar la respuesta
					{:else}
						{$replyStreamManager.get(message.id)?.content ?? 'Generando el mensaje'}
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
				{#if message.status === 'complete'}
					{#each message.tokens as token}
						{#if token.type === 'text'}
							<span>{token.content}</span>
						{:else}
							<span class="text-red-400 line-through">{token.content}</span>
							<span class="text-green-400">{token.suggestions[0].replacement}</span>
						{/if}
					{/each}
				{:else if message.status === 'failed'}
					(Error) {message.content}
				{:else if $correctStreamManager.get(message.id)?.status === 'done'}
					{@const tokens = segmentMessageByCorrections(
						message.content,
						llmJsonToCorrections(message.content, $correctStreamManager.get(message.id)!.content)
					)}
					{#each tokens as token}
						{#if token.type === 'text'}
							<span>{token.content}</span>
						{:else}
							<span class="text-red-400 line-through">{token.content}</span>
							<span class="text-green-400">{token.suggestions[0].replacement}</span>
						{/if}
					{/each}
				{:else if $correctStreamManager.get(message.id)?.status === 'streaming'}
					(Corrigiendo) {message.content}
				{:else}
					{message.content}
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
