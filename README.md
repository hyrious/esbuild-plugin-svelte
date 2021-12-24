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

// standalone typescript preprocessor powered by esbuild
import { typescript } from "@hyrious/esbuild-plugin-svelte";

// in svelte.config.js
export default {
  preprocess: [typescript({
    compilerOptions: {}
  })];
}
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

If you set this to `true`, it is also recommended to turn off [`compilerOptions.css`](https://svelte.dev/docs#svelte_compile).

### compilerOptions

See [`svelte.compile`](https://svelte.dev/docs#svelte_compile).

## Credits

- [sveltejs/vite-plugin-svelte](https://github.com/sveltejs/vite-plugin-svelte)
- [EMH333/esbuild-svelte](https://github.com/EMH333/esbuild-svelte)
- [rixo/svelte-hmr](https://github.com/sveltejs/svelte-hmr)

## Changelog

### 0.1.4

- Make `svelte()` also the default export.
- Completely removed source map text by appending an empty sourcemap.\
  Note that esbuild will still output the sourcemap file.

### 0.1.2

- Improved handling `src="./external-file.ts"`.
- Fixed crash when setting `emitCss: true` with no `<style>` tag.

## License

MIT @ [hyrious](https://github.com/hyrious)
