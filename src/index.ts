import { Plugin } from "esbuild";
import { CompileOptions } from "svelte/types/compiler/interfaces";
import { PreprocessorGroup } from "svelte/types/compiler/preprocess";
import { cwd } from "process";
import { relative, sep } from "path";
import { readFile } from "fs/promises";
import { compile, preprocess } from "svelte/compiler";
import { version } from "../package.json";
import { typescript } from "./typescript";
import { convertMessage, makeArray, quote } from "./utils";

export { version, typescript };

export interface Options {
  configFile?: string;
  filter?: RegExp;
  preprocess?: PreprocessorGroup | PreprocessorGroup[] | false;
  emitCss?: boolean;
  compilerOptions?: CompileOptions;
}

// based on https://esbuild.github.io/plugins/#svelte-plugin
export function svelte(options: Options = {}): Plugin {
  const filter = options.filter ?? /\.svelte$/;
  const processor =
    options.preprocess === false
      ? false
      : [...makeArray(options.preprocess ?? []), typescript()];
  const compilerOptions = options.compilerOptions;
  const emitCss = options.emitCss;

  return {
    name: "svelte",
    setup({ onLoad, onResolve }) {
      const root = cwd();
      const cssMap = new Map<string, { code: string; map: any }>();

      onLoad({ filter }, async args => {
        const source = await readFile(args.path, "utf8");
        const filename = "." + sep + relative(root, args.path);

        try {
          let code: string, sourcemap: string | object | undefined;
          if (processor !== false) {
            const processed = await preprocess(source, processor, { filename });
            code = processed.code;
            sourcemap = processed.map;
          } else {
            code = source;
          }

          const compiled = compile(code, {
            generate: "dom",
            ...compilerOptions,
            filename,
            sourcemap,
          });

          let { js, css } = compiled;
          if (emitCss) {
            const fakePath = args.path + ".css";
            cssMap.set(fakePath, css);
            js.code += `\nimport ${quote(fakePath)};`;
          }

          // esbuild doesn't read sources, it requires sourcesContent
          js.map.sourcesContent = [source];
          const contents = js.code + `\n//# sourceMappingURL=` + js.map.toUrl();
          const warnings = compiled.warnings.map(warning =>
            convertMessage(warning, filename, source)
          );

          return { contents, warnings };
        } catch (e) {
          return { errors: [convertMessage(e, filename, source)] };
        }
      });

      onResolve({ filter: /\.css$/ }, args => {
        if (!cssMap.has(args.path)) return;

        return { path: args.path, namespace: "svelte-fake-css" };
      });

      onLoad({ filter: /()/, namespace: "svelte-fake-css" }, args => {
        const { code, map } = cssMap.get(args.path)!;
        console.log(code, map);
        // TODO: build fake sourcemap

        return { contents: code, loader: "css" };
      });
    },
  };
}
