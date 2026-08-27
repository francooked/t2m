<script lang="ts">
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import { createFormView } from '$lib/forms/create-form-view.svelte';
	import { SIGN_OUT_ID, signOutFailure, signOutSuccess } from '$lib/forms/sign-out';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();

	let signOut = createFormView({
		id: SIGN_OUT_ID,
		success: signOutSuccess,
		failure: signOutFailure,
		getForm: () => page.form
	});

	const path = $derived(page.url.pathname);
</script>

<header>
	<p>Hola, <strong>{data.signedInUser.name}</strong></p>
	<form method="post" action="/logout?/signOut" use:enhance={signOut.enhance}>
		{#if signOut.view.status === 'failure'}
			<p>Error al cerrar sesión</p>
		{/if}
		<button type="submit" disabled={signOut.view.status === 'pending'}>
			{signOut.view.status === 'pending' ? 'Cargando' : 'Cerrar sesión'}
		</button>
	</form>
</header>

<nav aria-label="Secciones">
	<a href="/chats" aria-current={path.startsWith('/chats') ? 'page' : undefined}>Chats</a>
	<a href="/exercises" aria-current={path.startsWith('/exercises') ? 'page' : undefined}>
		Ejercicios
	</a>
	<a href="/feedbacks" aria-current={path.startsWith('/feedbacks') ? 'page' : undefined}>
		Retroalimentaciones
	</a>
</nav>

<main>
	{@render children()}
</main>

<style>
	header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		padding-bottom: 0.75rem;
		margin-bottom: 0.75rem;
		border-bottom: 1px solid var(--line);
	}

	header p {
		margin: 0;
		color: var(--muted);
		font-size: 0.9rem;
	}

	header strong {
		color: var(--ink);
		font-weight: 600;
	}

	header button {
		background: none;
		color: var(--muted);
		border: none;
		padding: 0;
		text-decoration: underline;
		text-underline-offset: 0.18em;
	}

	header button:hover:not(:disabled) {
		color: var(--ink);
		background: none;
	}

	nav {
		display: flex;
		flex-wrap: wrap;
		gap: 1.15rem;
		padding-bottom: 0.75rem;
		margin-bottom: 1.5rem;
		border-bottom: 1px solid var(--line);
	}

	nav a {
		text-decoration: none;
		color: var(--muted);
	}

	nav a:hover {
		color: var(--ink);
	}

	nav a[aria-current='page'] {
		color: var(--ink);
		text-decoration: underline;
		text-underline-offset: 0.35em;
	}
</style>
