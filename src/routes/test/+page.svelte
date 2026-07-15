<script lang="ts">
	import { tokenize } from '$lib/correction/blame';

	const text = 'This is a     tokenized message. I hope you can understand!';
	const tokenizedText = tokenize(text);

	$inspect(tokenizedText);
</script>
