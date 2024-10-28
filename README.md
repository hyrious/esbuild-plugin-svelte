# @hyrious/esbuild-plugin-svelte

Minimal efforts to make svelte work in esbuild.

## Install

```bash
$ npm add -D @hyrious/esbuild-plugin-svelte svelte esbuild
```

> [!NOTE]
>
> `esbuild` and `svelte` are peer dependencies!

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

## Credits

- [sveltejs/vite-plugin-svelte](https://github.com/sveltejs/vite-plugin-svelte)
- [EMH333/esbuild-svelte](https://github.com/EMH333/esbuild-svelte)
- [rixo/svelte-hmr](https://github.com/sveltejs/svelte-hmr)

## [Changelog](./CHANGELOG.md)

## License

MIT @ [hyrious](https://github.com/hyrious)
