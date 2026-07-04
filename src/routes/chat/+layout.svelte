<script lang="ts">
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();
</script>

<form method="post" action="/login?/signOut" class="p-2">
	<p>Hola, {data.user.name}</p>
	<button type="submit" class="font-medium">Sign Out</button>
</form>

<div>
	<a href="/chat" class="font-medium">Chats</a>
	<a href="/exercise" class="font-medium">Ejercicios</a>
</div>

{@render children?.()}
