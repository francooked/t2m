# Eval: error patterns

Runs the prompt in `src/lib/prompts/error-patterns.ts` against Groq. The yaml does not duplicate the system prompt: `prompt.ts` calls `buildPrompt` with each test's `vars`.

JSON schema is off for now so Groq returns the thinking trace next to the answer. Turn it back on once structured output works with `include_reasoning`.

## Setup

Set `GROQ_API_KEY` in `.env` (see `.env.example`). Do not put it in the yaml.

## Run

From any directory in the repo:

```sh
npm run eval:patterns
```

Same as `promptfoo eval -c promptfoo/error-patterns/promptfooconfig.yaml --env-file .env`.

To browse the history of every eval (not just this one):

```sh
npm run eval:view
```

## Add a case

In `promptfooconfig.yaml`, a test is the same `Input` that `buildPrompt` expects:

```yaml
tests:
  - vars:
      nativeLanguage: es
      targetLanguage: en
      mistakes:
        - wrote: I live here since 2019
          instead: I have lived here since 2019
          note: 'Con "since" se usa presente perfecto: "have lived".'
```

Edit the prompt (rules, few-shot, schema) in `src/lib/prompts/error-patterns.ts`. If the eval fails, change that file, not the yaml, unless the case itself is wrong.
