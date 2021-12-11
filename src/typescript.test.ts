import { test } from "uvu";
import * as assert from "uvu/assert";
import validate from "sourcemap-validator";
import { readFile } from "fs/promises";
import { compile, preprocess } from "svelte/compiler";
import { typescript } from "./typescript";

test("typescript.ts", async () => {
  const filename = "./src/fixtures/example.svelte";
  const source = await readFile(filename, "utf-8");
  const processor = typescript();
  const processed = await preprocess(source, processor, { filename });
  // note: preprocess drops "sourcesContent" field
  const { js } = compile(processed.code, {
    sourcemap: processed.map,
    filename,
    dev: true,
  });
  // fix "sources" field, which is only the basename
  js.map.sources = [filename];
  // note: compile also drops "sourcesContent" field
  assert.not.throws(() => {
    validate(js.code, js.map, { [filename]: source });
  });
});

test.run();
