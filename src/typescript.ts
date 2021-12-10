import process from "process";
import esbuild from "esbuild";
import { PreprocessorGroup } from "svelte/types/compiler/preprocess";
import { basename, dirname, resolve } from "path";
import { existsSync } from "fs";
import { readFile } from "fs/promises";

// based on https://github.com/lukeed/svelte-preprocess-esbuild
export function typescript(): PreprocessorGroup {
  const quote = JSON.stringify.bind(JSON);
  return {
    async script({ attributes, content, filename = "source.svelte" }) {
      if (attributes.lang !== "ts") return;
      const deps: string[] = [];
      if (typeof attributes.src === "string") {
        let src = attributes.src;
        src = resolve(dirname(filename), src);
        if (existsSync(src)) {
          content = await readFile(src, "utf-8");
          deps.push(src);
        } else {
          const [string] = await esbuild.formatMessages(
            [
              {
                text: `Could not find ${quote(src)} from ${quote(filename)}`,
                location: { file: filename },
              },
            ],
            { kind: "warning", color: true }
          );
          console.error(string);
        }
      }
      const { code, map, warnings } = await esbuild.transform(content, {
        loader: "ts",
        sourcefile: basename(filename),
        sourcemap: "external",
        tsconfigRaw: {
          compilerOptions: {
            preserveValueImports: true,
          },
        },
      });
      if (warnings.length > 0) {
        const strings = await esbuild.formatMessages(warnings, {
          kind: "warning",
          color: true,
        });
        for (const string of strings) {
          console.error(string);
        }
      }
      return { code, map, dependencies: deps };
    },
  };
}
