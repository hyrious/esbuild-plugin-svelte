# @hyrious/esbuild-plugin-svelte

Minimal efforts to make svelte work in esbuild.

## Install

```bash
$ npm add -D @hyrious/esbuild-plugin-svelte svelte esbuild
```

> **Note:** esbuild and svelte are peer dependencies!

## Usage

```js
import esbuild from "esbuild"
import { svelte } from "@hyrious/esbuild-plugin-svelte";

esbuild.build({
  entryPoints: ["main.js"],
  plugins: [svelte()],
});
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

By default it will append the `typescript()` preprocessor, which is powered by esbuild.
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

See [`svelte.compile`](https://svelte.dev/docs#svelte_compile).

## Credits

- [sveltejs/vite-plugin-svelte](https://github.com/sveltejs/vite-plugin-svelte)
- [EMH333/esbuild-svelte](https://github.com/EMH333/esbuild-svelte)
- [rixo/svelte-hmr](https://github.com/sveltejs/svelte-hmr)

## Changelog

### 0.1.8

- When `emitCss` is true, turn off css injecting and sourcemap by default.
- Change the CSS sourcemap name (if enabled) to `App.svelte?style.css`.

### 0.1.6

- Fixed invalid character error because of svelte using the `btoa` in node side.
- Fixed incorrect line numbers in warnings.\
  However I still don't know what is wrong here.
  The example in esbuild's website does have `start.line - 1`, but my recent test
  shows that it should be `start.line`.

### 0.1.4

- Make `svelte()` also the default export.
- Completely removed source map text by appending an empty sourcemap.\
  Note that esbuild will still output the sourcemap file.

### 0.1.2

- Improved handling `src="./external-file.ts"`.
- Fixed crash when setting `emitCss: true` with no `<style>` tag.

## License

MIT @ [hyrious](https://github.com/hyrious)
