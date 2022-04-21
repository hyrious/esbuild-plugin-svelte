import { suite } from "uvu";
import * as assert from "uvu/assert";
import { convertMessage, makeArray, warn } from "./utils";

const utils = suite("utils.ts");

utils("warn", async () => {
  const _warn = console.warn;
  let called: boolean;
  console.warn = () => {
    called = true;
  };

  called = false;
  await warn("example");
  assert.ok(called);

  called = false;
  await warn({ text: "example" });
  assert.ok(called);

  called = false;
  await warn([{ text: "example" }]);
  assert.ok(called);

  console.warn = _warn;
});

utils("makeArray", () => {
  assert.equal(makeArray(1), [1]);
  assert.equal(makeArray([]), []);

  // circular array
  let a: any[] = [];
  a.push(a);
  assert.is(makeArray(a), a);
});

utils("convertMessage", () => {
  const message = convertMessage(
    {
      message: "hello",
      start: { line: 0, column: 2 },
      end: { line: 0, column: 4 },
      code: `12345`,
    },
    "src/filename.svelte",
    `12345`
  );
  assert.equal(message, {
    text: "hello",
    location: {
      file: "src/filename.svelte",
      line: 1,
      column: 2,
      length: 2,
      lineText: `12345`,
    },
  });
});

utils.run();
