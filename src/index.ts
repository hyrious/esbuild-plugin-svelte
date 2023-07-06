import type { Location, PartialMessage, Plugin } from 'esbuild'
import type { CompileOptions, PreprocessorGroup } from 'svelte/compiler'
import type { Warning } from 'svelte/types/compiler/interfaces'

import { readFile } from 'fs/promises'
import { basename, relative, sep } from 'path'
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

      onLoad({ filter }, async (args) => {
        const watchFiles = [args.path]
        const source = await readFile(args.path, 'utf8')
        const filename = '.' + sep + relative(root, args.path)

        try {
          let code: string, sourcemap: any
          let warnings: PartialMessage[] = []

          if (options.preprocess !== false) {
            const onwarn = (w: PartialMessage) => warnings.push(w)
            const preprocessor = makeArray(options.preprocess ?? [])
            preprocessor.push(typescript({ esbuild, onwarn }))
            const processed = await preprocess(source, preprocessor, { filename })
            code = processed.code
            sourcemap = processed.map
            if (processed.dependencies) for (const dep of processed.dependencies) watchFiles.push(dep)
          } else {
            code = source
          }

          if (sourcemap) {
            for (let i = 0; i < sourcemap.sources.length; ++i) {
              if (sourcemap.sources[i] === filename) {
                sourcemap.sources[i] = basename(filename)
              }
            }
          }

          const compiled = compile(code, {
            ...compilerOptions,
            filename,
            sourcemap,
          })

          let { js, css } = compiled
          let entry = basename(filename)
          if (options.emitCss && css.code) {
            const fakePath = `./${entry}.css` // './' is intended here because it is source code
            cssMap.set(fakePath, { ...css, source, path: args.path + '.css' })
            js.code += `\nimport ${JSON.stringify(fakePath)};`
          }

          let contents = js.code
          if (js.map) {
            // svelte compiler drops all sourcesContent, we fix them for esbuild to pick up.
            // in case the code uses <script src="external-file">, there mat not be only 1 source.
            const sourcesContent: Array<string | null> = []
            for (const src of js.map.sources) {
              // svelte compiler also drops the dirname of the 'filename' passed in.
              if (src === entry) {
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
            warnings.push(convertMessage(w, args.path, source, sourcemap))
          }

          return { contents, warnings, watchFiles }
        } catch (err) {
          return { errors: [convertMessage(err, filename, source, null)] }
        }
      })

      onResolve({ filter: /\.css$/ }, (args) => {
        if (cssMap.has(args.path)) {
          const data = cssMap.get(args.path)
          cssMap.delete(args.path)
          return { path: args.path, pluginData: data }
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
