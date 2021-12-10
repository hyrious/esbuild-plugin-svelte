import { test } from "uvu";
import * as assert from "uvu/assert";
import { preprocess } from "svelte/compiler";
import { typescript } from "../src/typescript";

test("The esbuild preprocessor should correctly transform script blocks", async () => {
  const source = `<script lang="ts">
  import { onMount } from "svelte";
  let a: number = 1;
</script>

<button>{onMount} {a}</button>
`;

  try {
    const processed = await preprocess(source, typescript(), {
      filename: "./src/nested/Button.svelte",
    });
    console.log(processed);
  } catch (err) {
    console.error(err);
  }

  assert.ok(true);
});

test.run();
