import { transform, PartialMessage, TransformOptions } from "esbuild";
import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { basename, dirname, resolve } from "path";
import { PreprocessorGroup } from "svelte/types/compiler/preprocess";
import { quote, warn as warn_ } from "./utils";

export type CompilerOptions = NonNullable<
  Exclude<
    TransformOptions["tsconfigRaw"],
    string | undefined
  >["compilerOptions"]
>;

export interface Options {
  compilerOptions?: CompilerOptions;
  onwarn?: (
    message: PartialMessage,
    defaultHandler?: (message: PartialMessage) => void
  ) => void;
}

// based on https://github.com/lukeed/svelte-preprocess-esbuild
export function typescript(options?: Options): PreprocessorGroup {
  const onwarn = options?.onwarn;
  const warn = (warning: PartialMessage): void =>
    onwarn ? onwarn(warning, warn_) : /* c8 ignore next */ void warn_(warning);

  return {
    async script({
      attributes: { lang, src },
      content,
      filename = "source.svelte",
    }) {
      if (lang !== "ts") return;

      let dependencies: string[] | undefined;
      let sourcefile = basename(filename);
      if (typeof src === "string") {
        const resolved = resolve(dirname(filename), src);
        if (existsSync(resolved)) {
          content = await readFile(resolved, "utf-8");
          dependencies = [resolved];
          sourcefile = src;
        } else {
          const warning: PartialMessage = {
            text: `Could not find ${quote(src)} from ${quote(filename)}`,
            location: { file: filename },
          };
          warn(warning);
        }
      }

      const { code, map, warnings } = await transform(content, {
        loader: "ts",
        sourcefile,
        sourcemap: "external",
        tsconfigRaw: {
          compilerOptions: {
            preserveValueImports: true,
            ...options?.compilerOptions,
          },
        },
      });

      for (const warning of warnings) {
        warn(warning);
      }

      return { code, map, dependencies };
    },
  };
}
