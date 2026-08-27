<script lang="ts">
	import { enhance } from '$app/forms';
	import { RATE_ID, rateFailure, rateSuccess } from '$lib/forms/rate';
	import { createFormView } from '$lib/forms/create-form-view.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let rate = createFormView({
		id: RATE_ID,
		success: rateSuccess,
		failure: rateFailure,
		getForm: () => form
	});
</script>

<p class="back"><a href="/exercises">← Ejercicios</a></p>
<h1>Resultado</h1>

<p class="diff">
	{#each data.review.differences as { added, removed, value }, i (i)}
		{#if added}
			{#if value.trim() === ''}
				<span>{value}</span>
			{:else}
				<span class="add">{value}</span>
			{/if}
		{:else if removed}
			{#if value.trim() === ''}
				<span>{value}</span>
			{:else}
				<span class="rm">{value}</span>
			{/if}
			<!-- 
			Add a space after a removed chunk if the next difference also starts with a word/number character,
			so that deleted tokens don't merge with new/untouched ones visually. 
			-->
			{#if /[\p{L}\p{N}]+/gu.test(data.review.differences.at(i + 1)?.value ?? '')}
				<span>{' '}</span>
			{/if}
		{:else}
			<span>{value}</span>
		{/if}
	{/each}
</p>

{#if data.review.tips.length > 0}
	<h2>Tips</h2>
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
	<label for="rating">¿Qué tan difícil fue?</label>
	<select id="rating" name="rating">
		<option value="again">Again</option>
		<option value="hard">Hard</option>
		<option value="good">Good</option>
		<option value="easy">Easy</option>
	</select>
	<button type="submit" disabled={rate.view.status === 'pending'}>
		{rate.view.status === 'pending' ? 'Cargando' : 'Enviar'}
	</button>
</form>

<style>
	.back {
		margin: 0 0 0.65rem;
		font-size: 0.85rem;
	}

	.back a {
		color: var(--muted);
	}

	.diff {
		font-size: 1.15rem;
		line-height: 1.7;
		margin: 0 0 1.35rem;
	}

	.add {
		font-weight: 600;
		box-shadow: inset 0 -1px 0 var(--ink);
	}

	.rm {
		color: var(--muted);
		text-decoration: line-through;
	}

	form {
		display: flex;
		flex-direction: column;
		margin-top: 1.5rem;
	}
</style>
