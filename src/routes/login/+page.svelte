<script lang="ts">
	import { enhance } from '$app/forms';
	import { LANGUAGE_CODES, LANGUAGE_CODE_LABELS } from '$lib/constants';
	import { createFormView } from '$lib/forms/create-form-view.svelte';
	import { SIGN_IN_ID, signInFailure, signInSuccess } from '$lib/forms/sign-in';
	import { SIGN_UP_ID, signUpFailure, signUpSuccess } from '$lib/forms/sign-up';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
	let signIn = createFormView({ id: SIGN_IN_ID, success: signInSuccess, failure: signInFailure });
	let signUp = createFormView({ id: SIGN_UP_ID, success: signUpSuccess, failure: signUpFailure });

	const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

	signIn.sync(() => form);
	signUp.sync(() => form);

	$effect(() => {
		signIn.sync(() => form);
		signUp.sync(() => form);
	});
</script>

<form class="p-2" method="post" action="?/signInEmail" use:enhance={signIn.enhance}>
	{#if signIn.view.status === 'failure'}
		<p>Error al iniciar sesión</p>
	{/if}
	<h1 class="font-bold underline">Iniciar sesión</h1>
	<label for="signin_username">Correo</label>
	<input id="signin_username" name="email" type="email" />
	<label for="signin_password">Contraseña</label>
	<input id="signin_password" name="password" type="password" />
	<button type="submit" disabled={signIn.view.status === 'pending'}
		>{signIn.view.status === 'pending' ? 'Cargando' : 'Iniciar sesión'}</button
	>
</form>

<form class="p-2" method="post" action="?/signUpEmail" use:enhance={signUp.enhance}>
	{#if signUp.view.status === 'failure'}
		<p>Error al registrar</p>
	{/if}
	<h1 class="font-bold underline">Registrarse</h1>
	<label for="signup_email">Correo</label>
	<input id="signup_email" name="email" type="email" />
	<label for="signup_password">Contraseña</label>
	<input id="signup_password" name="password" type="password" />
	<label for="signup_name">Nombre</label>
	<input id="signup_name" name="name" type="text" />
	<label for="signup_native_language">Idioma Nativo</label>
	<select id="signup_native_language" name="native_language">
		{#each LANGUAGE_CODES as languageCode}
			<option value={languageCode}>{LANGUAGE_CODE_LABELS.es[languageCode]}</option>
		{/each}
	</select>
	<input type="hidden" name="time_zone" value={timeZone} />
	<button type="submit" disabled={signUp.view.status === 'pending'}
		>{signUp.view.status === 'pending' ? 'Cargando' : 'Registrarse'}</button
	>
</form>
