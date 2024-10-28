# Changelog

## 0.3.1

- Added `inspector` option.
- Fixed `*.svelte.ts` files was not matched correctly.

## 0.3.0

- Support Svelte 5. Main changes:
  - The preprocessor `typescript()` &hellip;
    - Removes the `esbuild` option.
    - Does not support `<script lang="ts" src="external-file.ts">` any more.
      You should use `.svelte.ts` files and import them directly.
    - Does not apply by default because Svelte 5 has builtin TypeScript preprocessor.
  - Added `dynamicCompileOptions` option.

## 0.2.3

- Lock peer dependency `svelte`'s version to &le;4.

## 0.2.2

- Fixed sourcemap "sources" field.

## 0.2.1

- Fixed incorrect line numbers in **errors**.

## 0.2.0

- Fixed incorrect line numbers in warnings.\
  This was fixed in 0.1.6 but I was wrong there. Now it's fixed for real.
- Use `verbatimModuleSyntax` when possible (esbuild &geq; 0.18).

## 0.1.8

- When `emitCss` is true, turn off css injecting and sourcemap by default.
- Change the CSS sourcemap name (if enabled) to `App.svelte?style.css`.

## 0.1.6

- Fixed invalid character error because of svelte using the `btoa` in node side.
- Fixed incorrect line numbers in warnings.\
  However I still don't know what is wrong here.
  The example in esbuild's website does have `start.line - 1`, but my recent test
  shows that it should be `start.line`.

## 0.1.4

- Make `svelte()` also the default export.
- Completely removed source map text by appending an empty sourcemap.\
  Note that esbuild will still output the sourcemap file.

## 0.1.2

- Improved handling `src="./external-file.ts"`.
- Fixed crash when setting `emitCss: true` with no `<style>` tag.
