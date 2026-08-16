<script lang="ts">
	import { enhance } from '$app/forms';
	import { createFormView } from '$lib/forms/create-form-view.svelte';
	import {
		ANSWER_EXERCISE_ID,
		answerExerciseFailure,
		answerExerciseSuccess
	} from '$lib/forms/answer-exercise';
	import {
		CHECK_ANSWER_ID,
		checkAnswerFailure,
		checkAnswerSuccess,
		type CheckAnswerSuccess
	} from '$lib/forms/check-answer';
	import type { PageProps } from './$types';

	let { params, data, form }: PageProps = $props();

	let checkAnswer = createFormView({
		id: CHECK_ANSWER_ID,
		success: checkAnswerSuccess,
		failure: checkAnswerFailure
	});

	let answerExercise = createFormView({
		id: ANSWER_EXERCISE_ID,
		success: answerExerciseSuccess,
		failure: answerExerciseFailure
	});

	let checkResult = $state<CheckAnswerSuccess | null>(null);

	checkAnswer.sync(() => form);
	answerExercise.sync(() => form);

	$effect(() => {
		checkAnswer.sync(() => form);
		answerExercise.sync(() => form);
	});

	$effect(() => {
		if (checkAnswer.view.status === 'success' && checkAnswer.view.data) {
			// Keep the rating step if sending the FSRS rating fails and replaces `form`.
			checkResult = checkAnswer.view.data;
		}
	});
</script>

<h1 class="font-medium">Ejercicio {params.id}</h1>
{#key params.id}
	{#if !checkResult}
		{#if data.exercise.type === 'full_answer' && data.exercise.version === 1}
			<form method="post" action="?/checkAnswer" use:enhance={checkAnswer.enhance}>
				{#if checkAnswer.view.status === 'failure'}
					<p>Error al responder</p>
				{/if}
				<p>{data.exercise.payload.extra}</p>
				<label for={`answer_${data.exercise.id}`}>Respuesta:</label>
				<input type="text" id={`answer_${data.exercise.id}`} name="answer" />
				<button type="submit" disabled={checkAnswer.view.status === 'pending'}
					>{checkAnswer.view.status === 'pending' ? 'Cargando' : 'Responder'}</button
				>
				<input type="hidden" name="exercise_id" value={data.exercise.id} />
			</form>
		{/if}
	{:else if data.exercise.type === 'full_answer' && data.exercise.version === 1}
		{#each checkResult.differences as { added, removed, value }}
			{#if added}
				<span class="bg-green-200">{value}</span>
			{:else if removed}
				<span class="bg-red-200">{value}</span>
			{:else}
				<span>{value}</span>
			{/if}
		{/each}
		{#if checkResult.tips.length > 0}
			<h2 class="font-medium">Tips</h2>
			<ul>
				{#each checkResult.tips as tip}
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
			<input type="hidden" name="exercise_id" value={data.exercise.id} />
			<button type="submit" disabled={answerExercise.view.status === 'pending'}
				>{answerExercise.view.status === 'pending' ? 'Cargando' : 'Enviar'}</button
			>
		</form>
	{/if}
{/key}
