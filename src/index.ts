import type { Location, PartialMessage, Plugin } from 'esbuild'
import type { CompileOptions, PreprocessorGroup } from 'svelte/compiler'
import type { Warning } from 'svelte/types/compiler/interfaces'

import { readFile } from 'fs/promises'
import { basename, relative } from 'path'
import { compile, preprocess } from 'svelte/compiler'
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping'
import { makeArray, typescript } from './typescript'

export { version } from '../package.json'

export { typescript }

const EmptySourceMap =
  'data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIiJdLCJtYXBwaW5ncyI6IkEifQ=='

function b64enc(b: string) {
  return Buffer.from(b).toString('base64')
}

function toUrl(map: any) {
  return 'data:application/json;charset=utf-8;base64,' + b64enc(map.toString())
}

export interface Options {
  /** Passed to [`onLoad()`](https://esbuild.github.io/plugins/#load-callbacks) */
  filter?: RegExp
  /** Svelte preprocessors, defaults to a TypeScript processor powered by esbuild. */
  preprocess?: PreprocessorGroup | PreprocessorGroup[] | false
  /** If true, it will emit `import "component.svelte.css"` at the end of the file to let esbuild bundle styles. */
  emitCss?: boolean
  /** See [svelte compiler options](https://svelte.dev/docs/svelte-compiler#types-compileoptions). */
  compilerOptions?: CompileOptions
}

export function svelte(options: Options = {}): Plugin {
  const filter = options.filter ?? /\.svelte$/
  const compilerOptions = options.compilerOptions ?? {}

  if (options.emitCss) {
    compilerOptions.css ??= 'external'
    compilerOptions.enableSourcemap ??= { js: true, css: false }
  }

  let enableSourcemap = { js: true, css: true }
  if (compilerOptions.enableSourcemap === false) {
    enableSourcemap = { js: false, css: false }
  } else if (typeof compilerOptions.enableSourcemap === 'object') {
    enableSourcemap = compilerOptions.enableSourcemap
  }

  return {
    name: 'svelte',
    setup({ esbuild, onLoad, onResolve }) {
      const root = process.cwd()
      const cssMap = new Map<string, any>()

      // TODO: this plugin now loads .svelte files as javascript files,
      // it can causes the warnings to be shown twice with different locations. example:
      //   test/e2e.svelte:10:50: [plugin svelte] [equals-negative-zero]
      //   test/e2e.svelte:40:10: [equals-negative-zero]
      // the first one is correct, the second one is actually "transformed" js code,
      // but we see no difference in their paths. (only the [plugin] part is different)
      onLoad({ filter }, async (args) => {
        const watchFiles = [args.path]
        const source = await readFile(args.path, 'utf8')
        const filename = relative(root, args.path).replace(/\\/g, '/')

        let code: string | undefined, sourcemap: any
        try {
          let warnings: PartialMessage[] = []

          // caution: svelte preprocess only handles basename, the sourcemap is changed!
          if (options.preprocess !== false) {
            const onwarn = (w: PartialMessage) => warnings.push(w)
            const preprocessor = makeArray(options.preprocess ?? [])
            // to override the typescript preprocessor, you just put another one before it
            preprocessor.push(typescript({ esbuild, onwarn }))
            const processed = await preprocess(source, preprocessor, { filename })
            code = processed.code
            sourcemap = processed.map
            if (processed.dependencies) for (const dep of processed.dependencies) watchFiles.push(dep)
          } else {
            code = source
          }

          const compiled = compile(code, {
            ...compilerOptions,
            filename,
            sourcemap,
          })

          let { js, css } = compiled
          if (options.emitCss && css.code) {
            const fakePath = `./${basename(filename)}.css` // './' is intended here because it is source code
            cssMap.set(fakePath, { ...css, source, path: args.path + '.css' })
            js.code += `\nimport ${JSON.stringify(fakePath)};`
          }

          let contents = js.code
          if (js.map) {
            // svelte compiler drops all sourcesContent, we fix them for esbuild to pick up.
            // in case the code uses <script src="external-file">, there mat not be only 1 source.
            const sourcesContent: Array<string | null> = []
            for (const src of js.map.sources) {
              if (src === basename(filename)) {
                sourcesContent.push(source)
              } else {
                // src="external-file" does not get a sourcemap, feature, not bug.
                sourcesContent.push(null)
              }
            }
            js.map.sourcesContent = sourcesContent
            contents += `\n//# sourceMappingURL=${toUrl(js.map)}`
          } else if (!enableSourcemap.js) {
            contents += `\n//# sourceMappingURL=${EmptySourceMap}`
          }

          for (const w of compiled.warnings) {
            warnings.push(convertMessage(w, args.path, code, sourcemap))
          }

          return { contents, warnings, watchFiles }
        } catch (err) {
          return { errors: [convertMessage(err, filename, code || source, sourcemap)] }
        }
      })

      onResolve({ filter: /\.css$/ }, (args) => {
        if (cssMap.has(args.path)) {
          const data = cssMap.get(args.path)
          cssMap.delete(args.path)
          return { path: data.path, pluginData: data }
        }
      })

      onLoad({ filter: /\.css$/ }, (args) => {
        if (args.pluginData) {
          const { code, map, source } = args.pluginData
          if (code === undefined) return

          let contents = code
          if (map) {
            // Prevent using the same name as js sources
            map.sources[0] += '?style.css'
            map.sourcesContent = [source]
            contents += `\n/*# sourceMappingURL=${toUrl(map)} */`
          } else if (!enableSourcemap.css) {
            contents += `\n/*# sourceMappingURL=${EmptySourceMap} */`
          }

          return { contents, loader: 'css' }
        }
      })
    },
  }
}

// reference: https://github.com/EMH333/esbuild-svelte
function convertMessage({ message, start, end }: Warning, filename: string, source: string, sourcemap: any) {
  let location: Partial<Location> | undefined
  if (start && end) {
    let lineText = source.split(/\r\n|\r|\n/g)[start.line - 1]
    let lineEnd = start.line === end.line ? end.column : lineText.length

    if (sourcemap) {
      sourcemap = new TraceMap(sourcemap)
      const pos = originalPositionFor(sourcemap, start)
      if (pos.source) {
        start.line = pos.line ?? start.line
        start.column = pos.column ?? start.column
      }
    }

    location = {
      file: filename,
      line: start.line,
      column: start.column,
      length: lineEnd - start.column,
      lineText,
    }
  }
  return { text: message, location }
}

export { svelte as default }
