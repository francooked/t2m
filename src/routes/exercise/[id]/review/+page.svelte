<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		ANSWER_EXERCISE_ID,
		answerExerciseFailure,
		answerExerciseSuccess
	} from '$lib/forms/answer-exercise';
	import { createFormView } from '$lib/forms/create-form-view.svelte';
	import type { PageProps } from './$types';

	let { data, form, params }: PageProps = $props();

	let answerExercise = createFormView({
		id: ANSWER_EXERCISE_ID,
		success: answerExerciseSuccess,
		failure: answerExerciseFailure,
		getForm: () => form
	});
</script>

{#each data.review.differences as { added, removed, value }, i (i)}
	{#if added}
		<span class="bg-green-200">{value}</span>
	{:else if removed}
		<span class="bg-red-200">{value}</span>
	{:else}
		<span>{value}</span>
	{/if}
{/each}

{#if data.review.tips.length > 0}
	<h2 class="font-medium">Tips</h2>
	<ul>
		{#each data.review.tips as tip, i (i)}
			<li>{tip}</li>
		{/each}
	</ul>
{/if}

<form method="post" action="?/answerExercise" use:enhance={answerExercise.enhance}>
	{#if answerExercise.view.status === 'failure'}
		<p>Error al enviar</p>
	{/if}
	<select name="rating">
		<option value="again">Again</option>
		<option value="hard">Hard</option>
		<option value="good">Good</option>
		<option value="easy">Easy</option>
	</select>
	<input type="hidden" name="exercise_id" value={params.id} />
	<button type="submit" disabled={answerExercise.view.status === 'pending'}
		>{answerExercise.view.status === 'pending' ? 'Cargando' : 'Enviar'}</button
	>
</form>
