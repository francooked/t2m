# Eval: conversation reply

Runs the prompt in `src/lib/prompts/conversation-reply.ts` against OpenAI. The yaml does not duplicate the system prompt: `prompt.ts` calls `buildPrompt` with each test's `vars` and sets the JSON schema.

## Setup

Set `OPENAI_API_KEY` and `LLM_MODEL` in `.env` (see `.env.example`). Do not put them in the yaml.

## Run

From any directory in the repo:

```sh
npm run eval:reply
```

Same as `promptfoo eval -c promptfoo/conversation-reply/promptfooconfig.yaml --env-file .env`.

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
      turns:
        - role: user
          content: Hi, I want to practice for my trip
```

Edit the prompt (rules, few-shot, schema) in `src/lib/prompts/conversation-reply.ts`. If the eval fails, change that file, not the yaml, unless the case itself is wrong.
