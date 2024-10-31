# @hyrious/esbuild-plugin-svelte

Minimal efforts to make svelte work in esbuild.

## Install

```bash
npm add -D @hyrious/esbuild-plugin-svelte svelte esbuild
```

## Usage

```js
import { build } from 'esbuild'
import { svelte } from '@hyrious/esbuild-plugin-svelte'

await build({
  entryPoints: ['main.js'],
  bundle: true,
  plugins: [svelte()],
}).catch(() => process.exit(1))
```

## Options

```js
svelte({
  filter: /\.svelte(\?.*)?$/,
  compilerOptions: {},
  preprocess: [],
  emitCss: true,
  inspector: void 0,
  dynamicCompileOptions: () => void 0,
})
```

### filter

Passed to esbuild [`onLoad()`](https://esbuild.github.io/plugins/#on-load)
callback to match svelte files.

### compilerOptions

See [svelte/compiler#CompileOptions](https://svelte.dev/docs/svelte/svelte-compiler#CompileOptions).

If not specified, the `dev` mode is detected with the following logic:

- If either one of the following config is set, `dev: false`.
  - `minify: true`
  - `define: { 'process.env.NODE_ENV': '"production"' }`
  - `define: { 'import.meta.env.NODE_ENV': '"production"' }`
  - `define: { 'import.meta.env.DEV': 'false' }`
- Otherwise, `dev: true`.

The `generate: 'server'` mode is set if `define['import.meta.env.SSR'] == 'true'`.

### preprocess

See [svelte/compiler#Preprocessor](https://svelte.dev/docs/svelte/svelte-compiler#Preprocessor).

You can opt-in the esbuild-powered TypeScript preprocessor by:

```js
import { svelte, typescript } from '@hyrious/esbuild-plugin-svelte'

svelte({
  // esbuild will print warnings on the final js, so suppress them here.
  preprocess: [typescript({ onwarn: false })],
})
```

### emitCss

Generate virtual CSS files. If `true` (by default), it will set svelte compile
options `css: 'external'` automatically.

### inspector

Enable svelte inspector during development (see the `dev` logic above).
You can set it to `false` to ensure it is not enabled anyway.

### dynamicCompileOptions

A function to update [`compilerOptions`](#compileroptions) before compilation.

```js
svelte({
  dynamicCompileOptions({ filename }) {
    if (filename.includes('node_modules')) return { runes: false }
  },
})
```

## Experimental

It also provides an <abbr title="Server-Side Rendering">SSR</abbr> plugin which
renders App.svelte on the server side and bakes it into the HTML template.

> [!IMPORTANT]
> The API may change without bumping the major version.

To use it, you need to install an additional peer dependency first:

```bash
npm add -D @hyrious/esbuild-dev
```

```js
import { build } from 'esbuild'
import { svelteSSR } from '@hyrious/esbuild-plugin-svelte'

await build({
  entryPoints: ['main.js'],
  bundle: true,
  plugins: [svelteSSR()],
}).catch(() => process.exit(1))
```

Also make sure to update your `main.js` to use `hydrate()` instead of `mount()`.

```js
// main.js
import { hydrate } from 'svelte'
import App from './App.svelte'

hydrate(App, { target: document.getElementById('app') })
```

This plugin will add `define['import.meta.env.SSR'] = 'true'` if it is not set.
You can add such TypeScript definition in your project to get code completions:

```ts
declare global {
  interface ImportMeta {
    readonly env: { readonly SSR: boolean }
  }
}
```

### Options

```js
svelteSSR({
  template: 'index.html',
  entryPoint: 'App.svelte',
  renderHTML: ({ head, body }) => '',
})
```

### template

The HTML filename to produce. It does not have to exist on the file system.
It's just for teaching esbuild to output a file. The filename must ends with `.html`.
If not provided, it defaults to `"index.html"`.

### entryPoint

The entry component to be executed on the server side.
If not provided, it will search for the following files in order:

- `"App.svelte"`
- `"src/App.svelte"`

### renderHTML

A function to render the SSR result of the `entryPoint` into `template`.
The result will be returned to esbuild as the contents of the `template` file.

```js
// Example renderHTML() implementation
async function renderHTML({ head, body }) {
  let html = await readFile('index.html', 'utf8')
  if (head) html = html.replace('</head>', head + '\n</head>')
  if (body) html = html.replace('id="app">', 'id="app">' + body)
  return html
}
```

## Credits

- [sveltejs/vite-plugin-svelte](https://github.com/sveltejs/vite-plugin-svelte)
- [EMH333/esbuild-svelte](https://github.com/EMH333/esbuild-svelte)
- [rixo/svelte-hmr](https://github.com/sveltejs/svelte-hmr)

## [Changelog](./CHANGELOG.md)

## License

MIT @ [hyrious](https://github.com/hyrious)
