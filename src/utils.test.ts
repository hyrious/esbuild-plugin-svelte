import { suite } from "uvu";
import * as assert from "uvu/assert";
import { warn } from "./utils";

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

utils.run();
