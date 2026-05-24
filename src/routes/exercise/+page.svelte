<script lang="ts">
	import type { PageProps } from './$types';

	const { data }: PageProps = $props();
	const previewNewExercises = $derived(data.newExercises.slice(0, 4));
	const previewPendingExercises = $derived(data.pendingExercises.slice(0, 4));
	const nextExercise = $derived.by(() => {
		const firstNewExerciseId = previewNewExercises.at(0)?.id;
		const firstPendingExerciseId = previewPendingExercises.at(0)?.id;
		if (typeof firstNewExerciseId === 'number') return firstNewExerciseId;
		if (typeof firstPendingExerciseId === 'number') return firstPendingExerciseId;
		return null;
	});
</script>

<h1 class="font-bold">Ejercicios</h1>

<h2 class="font-medium">Nuevos ({data.newExercises.length})</h2>
<ul>
	{#each previewNewExercises as exercise}
		{#if exercise.type === 'full_answer' && exercise.version === 2}
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
		{#if exercise.type === 'full_answer' && exercise.version === 2}
			<li>{exercise.payload.front}</li>
		{/if}
	{/each}
	{#if data.pendingExercises.length > 4}
		<li>Y {data.pendingExercises.length - 4} más</li>
	{/if}
</ul>

{#if nextExercise}
	<a href={`/exercise/${nextExercise}`}>Repasar</a>
{:else}
	Estás al día
{/if}
