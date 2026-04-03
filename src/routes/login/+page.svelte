<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { LANGUAGES } from '$lib/constants';
	import type { PageProps, SubmitFunction } from './$types';

	let {}: PageProps = $props();

	const handleSignInEmail: SubmitFunction = () => {
		return async ({ result, update }) => {
			if (result.type === 'redirect') {
				goto(result.location);
			} else if (result.type === 'failure') {
				console.log('failure:', result);
			}
		};
	};

	const handleSignUpEmail: SubmitFunction = () => {
		return async ({ result }) => {
			if (result.type === 'redirect') {
				goto(result.location);
			} else if (result.type === 'failure') {
				console.log('failure:', result);
			}
		};
	};
</script>

<form class="p-2" method="post" action="?/signInEmail" use:enhance={handleSignInEmail}>
	<h1 class="font-bold underline">Iniciar sesión</h1>
	<label for="signin_username">Correo</label>
	<input id="signin_username" name="email" type="email" />
	<label for="signin_password">Contraseña</label>
	<input id="signin_password" name="password" type="password" />
	<button type="submit">Iniciar sesión</button>
</form>

<form class="p-2" method="post" action="?/signUpEmail" use:enhance={handleSignUpEmail}>
	<h1 class="font-bold underline">Registrarse</h1>
	<label for="signup_email">Correo</label>
	<input id="signup_email" name="email" type="email" />
	<label for="signup_password">Contraseña</label>
	<input id="signup_password" name="password" type="password" />
	<label for="signup_name">Nombre</label>
	<input id="signup_name" name="name" type="text" />
	<label for="signup_native_language">Idioma Nativo</label>
	<select id="signup_native_language" name="native_language">
		<option value="">Selecciona un idioma</option>
		{#each LANGUAGES as language}
			<option value={language}>{language}</option>
		{/each}
	</select>
	<button type="submit">Registrarse</button>
</form>
