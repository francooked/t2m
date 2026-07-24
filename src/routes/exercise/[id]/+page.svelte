<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps, SubmitFunction } from './$types';
	import { goto } from '$app/navigation';

	let { params, data }: PageProps = $props();
	let phase = $state<'answering' | 'rating'>('answering');
	let tips = $state<string[]>([]);
	let expected = $state<string | null>(null);
	let answer = $state<string | null>(null);
	let differences = $state<{ added: boolean; removed: boolean; value: string }[]>([]);

	const handleCheckAnswer: SubmitFunction = async () => {
		return async ({ result }) => {
			if (result.type === 'failure') {
				console.log('failure:', result.data);
			} else if (result.type === 'success' && result.data) {
				tips = result.data.tips;
				phase = 'rating';
				expected = result.data.expected;
				answer = result.data.answer;
				differences = result.data.differences;
			}
		};
	};

	const handleSubmitAnswer: SubmitFunction = async () => {
		return async ({ result }) => {
			if (result.type === 'redirect') {
				tips = [];
				phase = 'answering';
				expected = null;
				answer = null;
				goto(result.location, { invalidateAll: true });
			} else if (result.type === 'failure') {
				console.log('failure:', result);
			}
		};
	};
</script>

<h1 class="font-medium">Ejercicio {params.id}</h1>
{#if phase === 'answering'}
	{#if data.exercise.type === 'full_answer' && data.exercise.version === 1}
		<form method="post" action="?/checkAnswer" use:enhance={handleCheckAnswer}>
			<p>{data.exercise.payload.extra}</p>
			<label for={`answer_${data.exercise.id}`}>Respuesta:</label>
			<input type="text" id={`answer_${data.exercise.id}`} name="answer" />
			<button type="submit">Responder</button>
			<input type="hidden" name="exercise_id" value={data.exercise.id} />
		</form>
	{/if}
{:else if data.exercise.type === 'full_answer' && data.exercise.version === 1}
	{#each differences as { added, removed, value }}
		{#if added}
			<span class="bg-green-200">{value}</span>
		{:else if removed}
			<span class="bg-red-200">{value}</span>
		{:else}
			<span>{value}</span>
		{/if}
	{/each}
	{#if tips.length > 0}
		<h2 class="font-medium">Tips</h2>
		<ul>
			{#each tips as tip}
				<li>{tip}</li>
			{/each}
		</ul>
	{/if}
	<form method="post" action="?/answerExercise" use:enhance={handleSubmitAnswer}>
		<select name="rating">
			<option value="again">Again</option>
			<option value="hard">Hard</option>
			<option value="good">Good</option>
			<option value="easy">Easy</option>
		</select>
		<input type="hidden" name="exercise_id" value={data.exercise.id} />
		<button type="submit">Enviar</button>
	</form>
{/if}
