export async function retry<T>({
	fn,
	retries = 3,
	delay = 1000
}: {
	fn: () => Promise<T>;
	retries?: number;
	delay?: number;
}): Promise<T> {
	let lastError: unknown;

	for (let i = 0; i < retries; i++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error;
			if (i < retries - 1) await new Promise((resolve) => setTimeout(resolve, delay));
		}
	}

	throw lastError;
}
