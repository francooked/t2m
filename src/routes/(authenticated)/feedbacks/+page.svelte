<script lang="ts">
	import { enhance } from '$app/forms';
	import { createFormView } from '$lib/forms/create-form-view.svelte';
	import {
		GIVE_FEEDBACK_ID,
		giveFeedbackFailure,
		giveFeedbackSuccess
	} from '$lib/forms/give-feedback';
	import type { PageProps } from './$types';

	const { data, form }: PageProps = $props();

	const giveFeedback = createFormView({
		id: GIVE_FEEDBACK_ID,
		success: giveFeedbackSuccess,
		failure: giveFeedbackFailure,
		getForm: () => form
	});
</script>

<h1 class="underline">Feedbacks</h1>

{#each data.feedbacks as feedback (feedback.id)}
	{#if feedback.payload.version === 1}
		{@const payload = feedback.payload.payload}
		{#each payload.patterns as pattern}
			<div>
				<ul>
					<li>what: {pattern.what}</li>
					<li>why: {pattern.why}</li>
					<li>how: {pattern.how}</li>
					<li>soundsLike: {pattern.soundsLike}</li>
				</ul>
				<ul>
					{#each pattern.examples as example}
						<li>wrote: {example.wrote} - instead: {example.instead}</li>
					{/each}
				</ul>
			</div>
		{/each}
	{/if}
{:else}
	<p>Sin retroalimentaciones</p>
{/each}

<form method="post" action="?/giveFeedback" use:enhance={giveFeedback.enhance}>
	{#if giveFeedback.view.status === 'failure'}
		<p>Ocurrió un error</p>
	{/if}
	<button type="submit" class="font-medium" disabled={giveFeedback.view.status === 'pending'}
		>{giveFeedback.view.status === 'pending' ? 'Cargando' : '¿Dónde estoy fallando?'}</button
	>
</form>
