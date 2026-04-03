<script lang="ts">
	import { LANGUAGES } from '$lib/constants';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<form>
	<textarea>Tu respuesta</textarea>
	<button type="submit">Enviar</button>
</form>
