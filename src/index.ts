import { PartialMessage, Plugin } from "esbuild";
import { CompileOptions } from "svelte/types/compiler/interfaces";
import { PreprocessorGroup } from "svelte/types/compiler/preprocess";
import { cwd } from "process";
import { basename, dirname, relative, resolve, sep } from "path";
import { readFile } from "fs/promises";
import { compile, preprocess } from "svelte/compiler";
import { version } from "../package.json";
import { typescript } from "./typescript";
import {
  convertMessage,
  EmptySourceMap,
  makeArray,
  quote,
  toUrl,
} from "./utils";

export { version, typescript };

export interface Options {
  filter?: RegExp;
  preprocess?: PreprocessorGroup | PreprocessorGroup[] | false;
  emitCss?: boolean;
  compilerOptions?: CompileOptions;
}

// based on https://esbuild.github.io/plugins/#svelte-plugin
export function svelte(options: Options = {}): Plugin {
  const filter = options.filter ?? /\.svelte$/;
  const compilerOptions = options.compilerOptions ?? {};

  if (options.emitCss) {
    compilerOptions.css ??= "external";
    compilerOptions.enableSourcemap ??= { js: true, css: false };
  }

  let enableSourcemap = { js: true, css: true };
  if (compilerOptions.enableSourcemap === false) {
    enableSourcemap = { js: false, css: false };
  } else if (typeof compilerOptions.enableSourcemap === "object") {
    enableSourcemap = compilerOptions.enableSourcemap;
  }

  return {
    name: "svelte",
    setup({ onLoad, onResolve }) {

      const root = cwd();
      const cssMap = new Map<string, any>();

      onLoad({ filter }, async args => {
        const watchFiles = [args.path];
        const source = await readFile(args.path, "utf8");
        const filename = "." + sep + relative(root, args.path);

        try {
          let code: string, sourcemap: string | object | undefined;
          const warnings: PartialMessage[] = [];

          if (options.preprocess !== false) {
            const onwarn = (warning: PartialMessage) => warnings.push(warning);
            const preprocessor = [...makeArray(options.preprocess ?? []), typescript({ onwarn })];
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
          const base = basename(filename);
          if (options.emitCss && css.code) {
            const fakePath = "./" + base + ".css";
            cssMap.set(fakePath, { ...css, source, path: args.path + ".css" });
            js.code += `\nimport ${quote(fakePath)};`;
          }

          let contents = js.code;
          if (js.map) {
            // svelte compile will drop all sourcesContent, we fix them
            // in case the code uses `src="./external.ts"`,
            // there may be not only 1 source
            const sourcesContent: (string | null)[] = [];
            for (const src of js.map.sources) {
              if (src === base) {
                sourcesContent.push(source);
              } else {
                const path = resolve(dirname(args.path), src);
                try {
                  sourcesContent.push(await readFile(path, "utf-8"));
                } catch (e) {
                  sourcesContent.push(null);
                  warnings.push(convertMessage(e, filename, source));
                }
              }
            }
            js.map.sourcesContent = sourcesContent;
            contents += `\n//# sourceMappingURL=` + toUrl(js.map);
          } else if (!enableSourcemap.js) {
            contents += `\n//# sourceMappingURL=` + EmptySourceMap;
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
          map.sources[0] += "?style.css";
          map.sourcesContent = [source];
          contents += `\n/*# sourceMappingURL=${toUrl(map)} */`;
        } else if (!enableSourcemap.css) {
          contents += `\n/*# sourceMappingURL=${EmptySourceMap} */`;
        }

        return { contents, loader: "css" };
      });
    },
  };
}

export default svelte;
