<script lang="ts">
	import { enhance } from '$app/forms';
	import { CHECK_ANSWER_ID, checkAnswerFailure, checkAnswerSuccess } from '$lib/forms/check-answer';
	import { createFormView } from '$lib/forms/create-form-view.svelte';
	import type { PageProps } from './$types';

	let { params, data, form }: PageProps = $props();

	let checkAnswer = createFormView({
		id: CHECK_ANSWER_ID,
		success: checkAnswerSuccess,
		failure: checkAnswerFailure,
		getForm: () => form
	});
</script>

<h1 class="font-medium">Ejercicio {params.id}</h1>

{#if data.exercise.type === 'full_answer' && data.exercise.version === 1}
	<form method="post" action="?/checkAnswer" use:enhance={checkAnswer.enhance}>
		{#if checkAnswer.view.status === 'failure'}
			<p>Error al responder: {checkAnswer.view.error.code}</p>
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
