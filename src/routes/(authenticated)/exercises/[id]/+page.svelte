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

<p class="back"><a href="/exercises">← Ejercicios</a></p>
<h1>Ejercicio {params.id}</h1>

{#if data.exercise.type === 'full_answer' && data.exercise.version === 1}
	<form method="post" action="?/answer" use:enhance={answer.enhance}>
		{#if answer.view.status === 'failure'}
			<p>Error al responder</p>
		{/if}
		<p class="prompt">{data.exercise.payload.extra}</p>
		<label for={`answer_${data.exercise.id}`}>Respuesta</label>
		<input type="text" id={`answer_${data.exercise.id}`} name="answer" />
		<button type="submit" disabled={answer.view.status === 'pending'}>
			{answer.view.status === 'pending' ? 'Cargando' : 'Responder'}
		</button>
	</form>
{/if}

<style>
	.back {
		margin: 0 0 0.65rem;
		font-size: 0.85rem;
	}

	.back a {
		color: var(--muted);
		text-decoration: underline;
	}

	h1 {
		font-size: 0.7rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--muted);
		margin-bottom: 0.5rem;
	}

	.prompt {
		font-size: 1.35rem;
		line-height: 1.3;
		letter-spacing: -0.02em;
		margin: 0 0 1.5rem;
	}

	form {
		display: flex;
		flex-direction: column;
	}
</style>
