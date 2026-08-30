# Eval: message correction

Runs the prompt in `src/lib/prompts/message-correction.ts` against Groq. The yaml does not duplicate the system prompt: `prompt.ts` calls `buildPrompt` with each test's `vars`.

## Setup

Set `GROQ_API_KEY` in `.env` (see `.env.example`). Do not put it in the yaml.

## Run

From any directory in the repo:

```sh
npm run eval:correction
```

Same as `promptfoo eval -c promptfoo/message-correction/promptfooconfig.yaml --env-file .env`.

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
      turns:
        - role: user
          content: Yesterday I go to the store
```

Edit the prompt (rules, few-shot, schema) in `src/lib/prompts/message-correction.ts`. If the eval fails, change that file, not the yaml, unless the case itself is wrong.
