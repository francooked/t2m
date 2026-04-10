import { GROQ_API_KEY } from '$env/static/private';
import Groq from 'groq-sdk';

export const groq = new Groq({ apiKey: GROQ_API_KEY });
