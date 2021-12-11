import esbuild from "esbuild";
import { exit } from "process";
import { svelte } from "../src";

esbuild
  .build({
    entryPoints: ["./main.ts"],
    bundle: true,
    plugins: [svelte({ emitCss: true, compilerOptions: { css: false } })],
    outdir: "./dist",
    sourcemap: true,
  })
  .catch(() => exit(1));
