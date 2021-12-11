import { suite } from "uvu";
import * as assert from "uvu/assert";
import validate from "sourcemap-validator";
import { basename } from "path";
import { readFile } from "fs/promises";
import { compile, preprocess } from "svelte/compiler";
import { Options, typescript } from "./typescript";

const ts = suite("typescript.ts");

async function compile_file(filename: string, options?: Options) {
  const source = await readFile(filename, "utf-8");
  const processor = typescript(options);
  const processed = await preprocess(source, processor, { filename });
  // note: preprocess drops "sourcesContent" field
  const { js } = compile(processed.code, {
    sourcemap: processed.map,
    filename,
    dev: true,
  });
  // fix "sources" field, which is only the basename
  assert.equal(js.map.sources, [basename(filename)]);
  js.map.sources = [filename];
  // note: compile also drops "sourcesContent" field
  assert.not.throws(() => {
    validate(js.code, js.map, { [filename]: source });
  });
}

ts("should generate correct sourcemap", async () => {
  await compile_file("./src/fixtures/example.svelte");
});

ts("should work with `src`", async () => {
  const filename = "./src/fixtures/src-nested.svelte";
  await compile_file(filename, {
    onwarn(message) {
      assert.match(message.text!, "Comparison with -0 using the");
    },
  });
});

ts("should yell at not founding `src`", async () => {
  const filename = "./src/fixtures/src-not-found.svelte";
  await compile_file(filename, {
    onwarn(message) {
      assert.is(message.location?.file, filename);
    },
  });
});

ts("should not process scripts without `lang=ts`", async () => {
  const filename = "./src/fixtures/not-ts.svelte";
  await compile_file(filename);
});

ts.run();
