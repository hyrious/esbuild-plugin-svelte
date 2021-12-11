import { PartialMessage, Plugin } from "esbuild";
import { CompileOptions } from "svelte/types/compiler/interfaces";
import { PreprocessorGroup } from "svelte/types/compiler/preprocess";
import { cwd } from "process";
import { basename, relative, sep } from "path";
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
    options.preprocess === false ? false : makeArray(options.preprocess ?? []);
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
        const watchFiles = [args.path];
        const source = await readFile(args.path, "utf8");
        const filename = "." + sep + relative(root, args.path);

        try {
          let code: string, sourcemap: string | object | undefined;
          const warnings: PartialMessage[] = [];

          if (processor !== false) {
            const onwarn = (warning: PartialMessage) => warnings.push(warning);
            const preprocessor = [...processor, typescript({ onwarn })];
            const processed = await preprocess(source, preprocessor, {
              filename,
            });
            code = processed.code;
            sourcemap = processed.map;
            if (processed.dependencies) {
              for (const dep of processed.dependencies) {
                watchFiles.push(dep);
              }
            }
          } else {
            code = source;
          }

          const compiled = compile(code, {
            ...compilerOptions,
            filename,
            sourcemap,
          });

          let { js, css } = compiled;
          if (emitCss && css.code) {
            const fakePath = "./" + basename(filename) + ".css";
            cssMap.set(fakePath, { ...css, source, path: args.path + ".css" });
            js.code += `\nimport ${quote(fakePath)};`;
          }

          let contents = js.code;
          if (js.map) {
            // esbuild doesn't read sources, it requires sourcesContent
            js.map.sourcesContent = [source];
            contents += `\n//# sourceMappingURL=` + js.map.toUrl();
          }
          for (const warning of compiled.warnings) {
            warnings.push(convertMessage(warning, filename, source));
          }

          return { contents, warnings, watchFiles };
        } catch (e) {
          return { errors: [convertMessage(e, filename, source)] };
        }
      });

      onResolve({ filter: /\.css$/ }, args => {
        if (!cssMap.has(args.path)) return;

        const data = cssMap.get(args.path);
        cssMap.delete(args.path);

        return { path: data.path, pluginData: data };
      });

      onLoad({ filter: /\.css$/ }, args => {
        if (!args.pluginData) return;

        const { code, map, source } = args.pluginData;
        if (code === undefined) return;

        let contents = code;
        if (map) {
          // prevent being the same name as js sources
          map.sources[0] += ".css";
          map.sourcesContent = [source];
          contents += `\n/*# sourceMappingURL=${map.toUrl()} */`;
        }

        return { contents, loader: "css" };
      });
    },
  };
}
