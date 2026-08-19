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

<form method="post" action="?/signOut" class="p-2" use:enhance={signOut.enhance}>
	{#if signOut.view.status === 'failure'}
		<p>Error al cerrar sesión</p>
	{/if}
	<button type="submit" class="font-medium" disabled={signOut.view.status === 'pending'}
		>{signOut.view.status === 'pending' ? 'Cargando' : 'Sign Out'}</button
	>
</form>
