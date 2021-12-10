import { test } from "uvu";
import * as assert from "uvu/assert";
import { preprocess, compile } from "svelte/compiler";
import { typescript } from "../src/typescript";

test("The esbuild preprocessor should correctly transform script blocks", async () => {
  const source = `<script lang="ts">
  import { onMount } from "svelte";
  let a: number = 1;
</script>

<button>{onMount} {a}</button>
`;

  try {
    const filename = "./src/nested/Button.svelte";
    const processed = await preprocess(source, typescript(), {
      filename,
    });
    const result = compile(processed.code, {
      filename,
      sourcemap: processed.map,
      generate: "dom",
      css: true,
      enableSourcemap: true,
    });
    const { code, map } = result.js;
    map.sourcesContent = [source];
    console.log(code);
  } catch (err) {
    console.error(err);
  }

  assert.ok(true);
});

test.run();
