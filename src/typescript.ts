import esbuild, { TransformOptions } from "esbuild";
import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { basename, dirname, resolve } from "path";
import { PreprocessorGroup } from "svelte/types/compiler/preprocess";
import { quote, warn } from "./utils";

export type CompilerOptions = NonNullable<
  Exclude<
    TransformOptions["tsconfigRaw"],
    string | undefined
  >["compilerOptions"]
>;

export interface Options {
  compilerOptions?: CompilerOptions;
}

// based on https://github.com/lukeed/svelte-preprocess-esbuild
export function typescript(options?: Options): PreprocessorGroup {
  return {
    async script({
      attributes: { lang, src },
      content,
      filename = "source.svelte",
    }) {
      if (lang !== "ts") return;

      let dependencies: string[] | undefined;
      if (typeof src === "string") {
        src = resolve(dirname(filename), src);
        if (existsSync(src)) {
          content = await readFile(src, "utf-8");
          dependencies = [src];
        } else {
          await warn({
            text: `Could not find ${quote(src)} from ${quote(filename)}`,
            location: { file: filename },
          });
        }
      }

      const { code, map, warnings } = await esbuild.transform(content, {
        loader: "ts",
        sourcefile: basename(filename),
        sourcemap: "external",
        tsconfigRaw: {
          compilerOptions: {
            preserveValueImports: true,
            ...options?.compilerOptions,
          },
        },
      });

      if (warnings.length > 0) {
        await warn(warnings);
      }

      return { code, map, dependencies };
    },
  };
}
