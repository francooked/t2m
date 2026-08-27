<script lang="ts">
	import { enhance } from '$app/forms';
	import { ANSWER_ID, answerFailure, answerSuccess } from '$lib/forms/answer';
	import { createFormView } from '$lib/forms/create-form-view.svelte';
	import type { PageProps } from './$types';

	let { params, data, form }: PageProps = $props();

	let answer = createFormView({
		id: ANSWER_ID,
		success: answerSuccess,
		failure: answerFailure,
		getForm: () => form
	});
</script>

<h1 class="font-medium">Ejercicio {params.id}</h1>

{#if data.exercise.type === 'full_answer' && data.exercise.version === 1}
	<form method="post" action="?/answer" use:enhance={answer.enhance}>
		{#if answer.view.status === 'failure'}
			<p>Error al responder</p>
		{/if}
		<p>{data.exercise.payload.extra}</p>
		<label for={`answer_${data.exercise.id}`}>Respuesta:</label>
		<input type="text" id={`answer_${data.exercise.id}`} name="answer" />
		<button type="submit" disabled={answer.view.status === 'pending'}
			>{answer.view.status === 'pending' ? 'Cargando' : 'Responder'}</button
		>
		<input type="hidden" name="exercise_id" value={data.exercise.id} />
	</form>
{/if}
