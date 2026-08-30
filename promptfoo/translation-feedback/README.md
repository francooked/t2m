# Eval: translation feedback

Runs the prompt in `src/lib/prompts/translation-feedback.ts` against Groq. The yaml does not duplicate the system prompt: `prompt.ts` calls `buildPrompt` with each test's `vars`.

JSON schema is off for now so Groq returns the thinking trace next to the answer. Turn it back on once structured output works with `include_reasoning`.

## Setup

Set `GROQ_API_KEY` in `.env` (see `.env.example`). Do not put it in the yaml.

## Run

From any directory in the repo:

```sh
npm run eval:feedback
```

Same as `promptfoo eval -c promptfoo/translation-feedback/promptfooconfig.yaml --env-file .env`.

To browse the history of every eval (not just this one):

```sh
npm run eval:view
```

## Add a case

In `promptfooconfig.yaml`, a test is the same `Input` that `buildPrompt` expects:

```yaml
tests:
  - vars:
      nativeLanguage: en
      targetLanguage: es
      original: I planned it last year
      expected: Lo planeé el año pasado
      answer: Lo planee la año pasado
```

Edit the prompt (rules, few-shot, schema) in `src/lib/prompts/translation-feedback.ts`. If the eval fails, change that file, not the yaml, unless the case itself is wrong.
