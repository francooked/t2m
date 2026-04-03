<script lang="ts">
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();
</script>

<form method="post" action="/login?/signOut" class="p-2">
	<p>Hi, {data.user.name}</p>
	<button type="submit">Sign Out</button>
</form>

{@render children?.()}
