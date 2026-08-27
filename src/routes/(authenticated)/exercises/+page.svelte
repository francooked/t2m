<script lang="ts">
	import type { PageProps } from './$types';

	const { data }: PageProps = $props();
	const previewUnratedExercises = $derived(data.unratedExercises.slice(0, 4));
	const previewNewExercises = $derived(data.newExercises.slice(0, 4));
	const previewPendingExercises = $derived(data.pendingExercises.slice(0, 4));
</script>

<h1>Ejercicios</h1>

<section>
	<h2>Sin calificar ({data.unratedExercises.length})</h2>
	<ul>
		{#each previewUnratedExercises as exercise (exercise.id)}
			{#if exercise.type === 'full_answer' && exercise.version === 1}
				<li>{exercise.payload.extra}</li>
			{/if}
		{/each}
		{#if data.unratedExercises.length > 4}
			<li class="more">(+{data.unratedExercises.length - 4})</li>
		{/if}
	</ul>
</section>

<section>
	<h2>Nuevos ({data.newExercises.length})</h2>
	<ul>
		{#each previewNewExercises as exercise (exercise.id)}
			{#if exercise.type === 'full_answer' && exercise.version === 1}
				<li>{exercise.payload.extra}</li>
			{/if}
		{/each}
		{#if data.newExercises.length > 4}
			<li class="more">(+{data.newExercises.length - 4})</li>
		{/if}
	</ul>
</section>

<section>
	<h2>Pendientes ({data.pendingExercises.length})</h2>
	<ul>
		{#each previewPendingExercises as exercise (exercise.id)}
			{#if exercise.type === 'full_answer' && exercise.version === 1}
				<li>{exercise.payload.front}</li>
			{/if}
		{/each}
		{#if data.pendingExercises.length > 4}
			<li class="more">Y {data.pendingExercises.length - 4} más</li>
		{/if}
	</ul>
</section>

{#if data.nextExercise}
	<a class="cta" href={`/exercises/${data.nextExercise.id}`}>Repasar</a>
{:else}
	<p class="caught-up">Estás al día</p>
{/if}

<style>
	section + section {
		margin-top: 1.35rem;
	}

	section h2 {
		margin-top: 0;
	}

	li {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.more {
		color: var(--muted);
		font-size: 0.85rem;
	}

	.cta {
		display: inline-block;
		margin-top: 1.75rem;
		padding: 0.5rem 1rem;
		background: var(--ink);
		color: #fff;
		text-decoration: none;
	}

	.cta:hover {
		color: #fff;
		background: #000;
	}

	.caught-up {
		margin-top: 1.75rem;
		color: var(--muted);
	}
</style>
