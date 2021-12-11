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
  filter?: RegExp;
  preprocess?: PreprocessorGroup | PreprocessorGroup[] | false;
  emitCss?: boolean;
  compilerOptions?: CompileOptions;
}

const WarnOnMultipleCss =
  "You have set `emitCss: true`, it is recommended to also set `compilerOptions: { css: false }`.";

// based on https://esbuild.github.io/plugins/#svelte-plugin
export function svelte(options: Options = {}): Plugin {
  const filter = options.filter ?? /\.svelte$/;
  const processor =
    options.preprocess === false
      ? false
      : [...makeArray(options.preprocess ?? []), typescript()];
  const emitCss = options.emitCss;
  const compilerOptions = options.compilerOptions;

  const warnOnStart = emitCss && compilerOptions?.css !== false;

  return {
    name: "svelte",
    setup({ onLoad, onResolve, onStart }) {
      if (warnOnStart) {
        onStart(() => ({ warnings: [{ text: WarnOnMultipleCss }] }));
      }

      const root = cwd();
      const cssMap = new Map<string, any>();

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
            cssMap.set(fakePath, { ...css, source });
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
        // notice: no namespace here, we just pass this path to onLoad
        // the default (file) namespace will help editing the "sources" field
        // in sourcemap to let it always be relative to the dist folder
        return { path: args.path };
      });

      onLoad({ filter: /\.css$/ }, args => {
        if (!cssMap.has(args.path)) return;

        const { code, map, source } = cssMap.get(args.path)!;
        // prevent being the same name as js sources
        map.sources[0] += ".css";
        map.sourcesContent = [source];
        const contents = code + `\n/*# sourceMappingURL=${map.toUrl()} */`;

        // have loaded this file, remove it from memory
        cssMap.delete(args.path);

        return { contents, loader: "css" };
      });
    },
  };
}
