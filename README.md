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
  preprocess: [typescript()];
}
```

### Options

```js
svelte({
  
});
```

## Credits

- [sveltejs/vite-plugin-svelte](https://github.com/sveltejs/vite-plugin-svelte)
- [EMH333/esbuild-svelte](https://github.com/EMH333/esbuild-svelte)
- [rixo/svelte-hmr](https://github.com/sveltejs/svelte-hmr)

## License

MIT @ [hyrious](https://github.com/hyrious)
