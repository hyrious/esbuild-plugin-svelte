import { suite } from "uvu";
import * as assert from "uvu/assert";
import validate from "sourcemap-validator";
import { basename } from "path";
import { readFile } from "fs/promises";
import { compile, preprocess } from "svelte/compiler";
import { Options, typescript } from "./typescript";

const ts = suite("typescript.ts");

async function compile_file(
  filename: string,
  options?: Options,
  addedSources?: Record<string, string>
) {
  const source = await readFile(filename, "utf-8");
  const processor = typescript(options);
  const processed = await preprocess(source, processor, { filename });
  // note: preprocess drops "sourcesContent" field
  const { js } = compile(processed.code, {
    sourcemap: processed.map,
    filename,
    dev: true,
  });
  assert.equal(js.map.sources, [
    basename(filename),
    ...Object.keys({ ...addedSources }),
  ]);
  // fix "sources" field, whose first is only the basename
  js.map.sources[0] = filename;
  // note: compile also drops "sourcesContent" field
  assert.not.throws(() => {
    validate(js.code, js.map, { [filename]: source, ...addedSources });
  });
}

ts("should generate correct sourcemap", async () => {
  await compile_file("./src/fixtures/example.svelte");
});

ts("should work with `src`", async () => {
  const filename = "./src/fixtures/src-nested.svelte";
  const external = await readFile("./src/fixtures/nested/script.ts", "utf-8");
  await compile_file(
    filename,
    {
      onwarn(message) {
        assert.match(message.text!, "Comparison with -0 using the");
      },
    },
    { "./nested/script.ts": external }
  );
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
