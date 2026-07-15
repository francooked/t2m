<script lang="ts">
	import { createEmptyCard, fsrs, Rating, generatorParameters, type Card } from 'ts-fsrs';

	// Initialize generator parameters.
	// Me imagino que esto se serializa y guarda cuando un usuario se crea una cuenta
	const params = generatorParameters();
	console.log('params:', params);
	// console.log('params:', JSON.stringify(params));

	// Initialize the scheduler.
	const scheduler = fsrs(params);

	// Create a new card.
	// Me imagino que esto se crea cuando el usuario se equivoca
	const card = createEmptyCard(new Date());

	// Preview all possible scheduling outcomes.
	const preview = scheduler.repeat(card, new Date());
	// console.log('Raing.Again', preview[Rating.Again].card);
	// console.log('Rating.Hard', preview[Rating.Hard].card);
	// console.log('Rating.Good', preview[Rating.Good].card);
	// console.log('Rating.Easy', preview[Rating.Easy].card);

	// Apply a specific rating.
	// Pueden haber diferentes formas de evaluar, asumamos escritura:
	// Si el usuario acierta, el tiempo que le tomó podría decidir si fue Hard/Good/Easy
	const result = scheduler.next(card, new Date(), Rating.Good);
	console.log('result.card', result.card);
	// console.log('result.log', result.log);

	const updatedCard = result.card;
	const updatedResult = scheduler.next(updatedCard, updatedCard.due, Rating.Good);
	console.log('updatedResult.card', updatedResult.card);
	// console.log('updatedResult.log', updatedResult.log);

	const updatedUpdatedCard = updatedResult.card;
	const updatedUpdatedResult = scheduler.next(
		{ ...updatedUpdatedCard },
		updatedUpdatedCard.due,
		Rating.Good
	);
	// console.log('updatedUpdatedResult.card', updatedUpdatedResult.card);
	console.log('updatedUpdatedResult.log', updatedResult.log);
</script>

- Add generic `exercise` table to suppport any exercise format through a versioned, strong-typed,
JSON payload with flexible source tracking.
