# Eval: conversation reply

Runs the prompt in `src/lib/prompts/conversation-reply.ts` against Groq. The yaml does not duplicate the system prompt: `prompt.ts` calls `buildPrompt` with each test's `vars`.

JSON schema is off for now so Groq returns the thinking trace next to the answer. Turn it back on once structured output works with `include_reasoning`.

## Setup

Set `GROQ_API_KEY` in `.env` (see `.env.example`). Do not put it in the yaml.

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
