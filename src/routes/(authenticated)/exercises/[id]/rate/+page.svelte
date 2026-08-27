<script lang="ts">
	import { enhance } from '$app/forms';
	import { RATE_ID, rateFailure, rateSuccess } from '$lib/forms/rate';
	import { createFormView } from '$lib/forms/create-form-view.svelte';
	import type { PageProps } from './$types';

	let { data, form, params }: PageProps = $props();

	let rate = createFormView({
		id: RATE_ID,
		success: rateSuccess,
		failure: rateFailure,
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

<form method="post" action="?/rate" use:enhance={rate.enhance}>
	{#if rate.view.status === 'failure'}
		<p>Error al enviar</p>
	{/if}
	<select name="rating">
		<option value="again">Again</option>
		<option value="hard">Hard</option>
		<option value="good">Good</option>
		<option value="easy">Easy</option>
	</select>
	<input type="hidden" name="exercise_id" value={params.id} />
	<button type="submit" disabled={rate.view.status === 'pending'}
		>{rate.view.status === 'pending' ? 'Cargando' : 'Enviar'}</button
	>
</form>
