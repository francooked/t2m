<script lang="ts">
	import { enhance } from '$app/forms';
	import { createFormView } from '$lib/forms/create-form-view.svelte';
	import { SIGN_OUT_ID, signOutFailure, signOutSuccess } from '$lib/forms/sign-out';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();
	let signOut = createFormView({
		id: SIGN_OUT_ID,
		success: signOutSuccess,
		failure: signOutFailure
	});
</script>

<form method="post" action="/login?/signOut" class="p-2" use:enhance={signOut.enhance}>
	{#if signOut.view.status === 'failure'}
		<p>Error al cerrar sesión</p>
	{/if}
	<p>Hola, {data.user.name}</p>
	<button type="submit" class="font-medium" disabled={signOut.view.status === 'pending'}
		>{signOut.view.status === 'pending' ? 'Cargando' : 'Sign Out'}</button
	>
</form>

<div>
	<a href="/chat" class="font-medium">Chats</a>
	<a href="/exercise" class="font-medium">Ejercicios</a>
</div>

{@render children?.()}
