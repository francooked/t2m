<script lang="ts">
	import type { PageProps } from './$types';

	const { data }: PageProps = $props();
	const previewUnratedExercises = $derived(data.unratedExercises.slice(0, 4));
	const previewNewExercises = $derived(data.newExercises.slice(0, 4));
	const previewPendingExercises = $derived(data.pendingExercises.slice(0, 4));
</script>

<h1 class="font-bold">Ejercicios</h1>

<h2 class="font-medium">Sin calificar ({data.unratedExercises.length})</h2>
<ul>
	{#each previewUnratedExercises as exercise}
		{#if exercise.type === 'full_answer' && exercise.version === 1}
			<li>{exercise.payload.extra}</li>
		{/if}
	{/each}
	{#if data.unratedExercises.length > 4}
		<li>(+{data.unratedExercises.length - 4})</li>
	{/if}
</ul>

<h2 class="font-medium">Nuevos ({data.newExercises.length})</h2>
<ul>
	{#each previewNewExercises as exercise}
		{#if exercise.type === 'full_answer' && exercise.version === 1}
			<li>{exercise.payload.extra}</li>
		{/if}
	{/each}
	{#if data.newExercises.length > 4}
		<li>(+{data.newExercises.length - 4})</li>
	{/if}
</ul>

<h2 class="font-medium">Pendientes ({data.pendingExercises.length})</h2>
<ul>
	{#each previewPendingExercises as exercise}
		{#if exercise.type === 'full_answer' && exercise.version === 1}
			<li>{exercise.payload.front}</li>
		{/if}
	{/each}
	{#if data.pendingExercises.length > 4}
		<li>Y {data.pendingExercises.length - 4} más</li>
	{/if}
</ul>

{#if data.nextExercise}
	<a href={`/exercise/${data.nextExercise.id}`}>Repasar</a>
{:else}
	Estás al día
{/if}
