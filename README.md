# @hyrious/esbuild-plugin-svelte

Minimal efforts to make svelte work in esbuild.

## Install

```bash
$ npm add -D @hyrious/esbuild-plugin-svelte svelte esbuild
```

> **Note:** esbuild and svelte are peer dependencies!

## Usage

```js
import { build } from 'esbuild'
import { svelte } from '@hyrious/esbuild-plugin-svelte'

build({
  entryPoints: ['main.js'],
  bundle: true,
  plugins: [svelte()],
})
```

### Options

```js
import { typescript } from "@hyrious/esbuild-plugin-svelte";

svelte({
  filter: /\.svelte$/;
  preprocess: typescript();
  emitCss: false;
  compilerOptions: {};
});
```

### filter

The regexp passed to [`onLoad()`](https://esbuild.github.io/plugins/#load-callbacks).

### preprocess

If set, it will run `svelte.preprocess(source, processors)` before `svelte.compile()`.

By default it will enable the `typescript()` preprocessor which uses esbuild to transform `<script lang="ts">` blocks.
If you want to totally turn off preprocessing, set this option to `false`.

### emitCss

Whether to emit `<style>` parts of your svelte components to a .css file.
It is implemented by appending an `import "path/to/component.svelte.css"`
statement to the end of the compiled js code.

If you set this to `true`, it will add these default config to compiler options:

```js
{
  css: "external",
  enableSourcemap: { js: true, css: false },
}
```

### compilerOptions

See [`svelte.compile`](https://svelte.dev/docs/svelte-compiler#types-compileoptions).

## Credits

- [sveltejs/vite-plugin-svelte](https://github.com/sveltejs/vite-plugin-svelte)
- [EMH333/esbuild-svelte](https://github.com/EMH333/esbuild-svelte)
- [rixo/svelte-hmr](https://github.com/sveltejs/svelte-hmr)

## [Changelog](./CHANGELOG.md)

## License

MIT @ [hyrious](https://github.com/hyrious)
