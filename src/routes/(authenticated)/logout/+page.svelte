<script lang="ts">
	import { enhance } from '$app/forms';
	import { createFormView } from '$lib/forms/create-form-view.svelte';
	import { SIGN_OUT_ID, signOutFailure, signOutSuccess } from '$lib/forms/sign-out';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();

	let signOut = createFormView({
		id: SIGN_OUT_ID,
		success: signOutSuccess,
		failure: signOutFailure,
		getForm: () => form
	});
</script>

<h1>Sesión</h1>

<form method="post" action="?/signOut" use:enhance={signOut.enhance}>
	{#if signOut.view.status === 'failure'}
		<p>Error al cerrar sesión</p>
	{/if}
	<button type="submit" disabled={signOut.view.status === 'pending'}>
		{signOut.view.status === 'pending' ? 'Cargando' : 'Cerrar sesión'}
	</button>
</form>
