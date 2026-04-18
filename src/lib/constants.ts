export const TIME_ZONE = 'America/Santiago' as const;
export const LANGUAGES = ['en', 'es'] as const;
export const ROLES = ['assistant', 'user'] as const;
export const MESSAGE_STATUS = [
	'pending',
	'generating',
	'correcting',
	'complete',
	'failed'
] as const;
export const EXERCISE_TYPES = ['full_answer'] as const;
export const SRS_ALGORITHMS = ['fsrs'] as const;
export const FSRS_RATINGS = ['again', 'hard', 'good', 'easy'] as const;
