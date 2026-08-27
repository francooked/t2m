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

<h1>Retroalimentaciones</h1>

{#each data.feedbacks as feedback (feedback.id)}
	{#if feedback.payload.version === 1}
		{@const payload = feedback.payload.payload}
		{#each payload.patterns as pattern, i (i)}
			<section>
				<p class="what">{pattern.what}</p>
				<p>{pattern.why}</p>
				<p>{pattern.how}</p>
				<p class="sounds">{pattern.soundsLike}</p>
				<ul>
					{#each pattern.examples as example, j (j)}
						<li>
							<span class="wrote">{example.wrote}</span>
							<span class="arrow">→</span>
							<span>{example.instead}</span>
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	{/if}
{:else}
	<p class="empty">Sin retroalimentaciones</p>
{/each}

<form method="post" action="?/giveFeedback" use:enhance={giveFeedback.enhance}>
	{#if giveFeedback.view.status === 'failure'}
		<p>Ocurrió un error</p>
	{/if}
	<button type="submit" disabled={giveFeedback.view.status === 'pending'}>
		{giveFeedback.view.status === 'pending' ? 'Cargando' : '¿Dónde estoy fallando?'}
	</button>
</form>

<style>
	section {
		padding: 1.1rem 0 0.35rem;
		border-top: 1px solid var(--line);
	}

	section:first-of-type {
		border-top: 0;
		padding-top: 0;
	}

	.what {
		font-weight: 600;
		margin-bottom: 0.4rem;
	}

	.sounds {
		color: var(--muted);
		font-size: 0.9rem;
	}

	.wrote {
		color: var(--muted);
		text-decoration: line-through;
	}

	.arrow {
		color: var(--muted);
		margin: 0 0.35rem;
	}

	.empty {
		color: var(--muted);
		padding: 1rem 0 1.5rem;
	}

	form {
		margin-top: 1.75rem;
		padding-top: 1.25rem;
		border-top: 1px solid var(--line);
	}
</style>
