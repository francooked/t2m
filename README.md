# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project
npx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
npx sv@0.13.1 create --template minimal --types ts --add prettier eslint vitest="usages:unit,component" tailwindcss="plugins:typography,forms" sveltekit-adapter="adapter:node" drizzle="database:postgresql+postgresql:postgres.js+docker:yes" mcp="ide:cursor+setup:remote" --install npm .
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## Draft

Tengo un chat con múltiples mensajes.
Cada chat tiene un idioma objetivo.
(id chat, enum idioma)

Cada mensaje puede ser de la IA o del usuario.
Si es del usuario, puede contener correcciones.
Si es de la IA, es un texto plano.

Las correcciones tienen una razón.
(id corrección, id razón)
Cada corrección tiene múltiples sugerencias.
(id corrección, inicio, fin, sugerencia).

Cada usuario tiene un idioma nativo.
No puede ser modificado, porque las sugerencias
que hace el sistema consideran el idioma nativo
del aprendiz.
(correo, contraseña hasheada, idioma)

## Casos borde

Lo que está entre `<e>` y `</e>` es un error y entre `<s>` y `</s>` una sugerencia del LLM.

```
No sé, <e>cúales tú recomendarme</e> <s>¿Cuáles me recomendarías?</s>?
```

La sugerencia no debería incluir texto anterior a donde se encuentra el error en sí

```
Me gusta salir a caminar por calles <e>donde gente caminar no</e><s>Me gusta salir a caminar por calles donde la gente no camina.</s>
```

La sugerencia no debería incluir texto anterior a donde se encuentra el error en sí

```
Me gustaría <e>ir salir</e> <s>ir de vacaciones</s> vacaciones
```
