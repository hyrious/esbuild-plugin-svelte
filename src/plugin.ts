import { OnLoadArgs, PartialMessage, Plugin, PluginBuild } from 'esbuild'
import { readFile } from 'node:fs/promises'
import { basename, relative } from 'node:path'
import {
  preprocess,
  compile,
  compileModule,
  PreprocessorGroup,
  CompileOptions,
  Warning,
} from 'svelte/compiler'
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping'

export interface SvelteOptions {
  /// Passed to esbuild to filter in svelte files.
  /// Note that `.svelte.js/ts` are always processed by this plugin.
  filter?: RegExp
  /// See [svelte compiler options](https://svelte.dev/docs/svelte/svelte-compiler#CompileOptions).
  compilerOptions?: CompileOptions
  /// Svelte preprocessors.
  preprocess?: PreprocessorGroup | PreprocessorGroup[]
  /// If `true` (by default), emit `import 'component.svelte.css'` at the end of the file.
  emitCss?: boolean
  // Enable svelte inspector during development.
  // inspector?: boolean
  /// Alter svelte compile options for each file. Returns the partial options you want to change.
  dynamicCompileOptions?: (data: {
    filename: string
    code: string
    compileOptions: CompileOptions
  }) => Promise<CompileOptions | void> | CompileOptions | void
}

/// Do not reuse this plugin's instance in dev / prod / server build.
/// Instead, create individual instances for different places.
export function svelte(options: SvelteOptions = {}): Plugin {
  const cssCache = new Map<string, string>()

  const emitCss = (options.emitCss ??= true)
  const filter = (options.filter ??= /\.svelte(\?.*)?$/)
  const compilerOptions = (options.compilerOptions ??= {})

  if (emitCss) compilerOptions.css ??= 'external'

  return {
    name: 'svelte',
    setup(build) {
      const root = process.cwd()

      compilerOptions.dev ??= isInDevMode(build)
      compilerOptions.generate ??= isInSsrMode(build) ? 'server' : 'client'

      build.onEnd(() => cssCache.clear())

      build.onLoad({ filter }, async (args) => {
        const filename = relative(root, args.path).replaceAll('\\', '/')

        const query = new URLSearchParams(args.suffix)
        if (query.has('svelte') && query.get('type') == 'style') {
          const css = cssCache.get(args.path)
          cssCache.delete(args.path)
          if (css) return { contents: css, loader: 'css' }
        }

        const source = await readFile(args.path, 'utf8')
        const watchFiles: string[] = []

        let code: string | undefined, sourcemap: string | object | undefined

        try {
          if (options.preprocess) {
            const processed = await preprocess(source, options.preprocess, { filename })
            code = processed.code
            sourcemap = processed.map
            if (processed.dependencies) for (const file of processed.dependencies) watchFiles.push(file)
          } else {
            code = source
          }

          if (options.dynamicCompileOptions) {
            const changes = options.dynamicCompileOptions({
              filename,
              code,
              compileOptions: compilerOptions,
            })
            if (changes) Object.assign(compilerOptions, changes)
          }

          const compiled = compile(code, {
            ...compilerOptions,
            filename,
            sourcemap,
          })

          if (emitCss && (compiled.css?.code.trim().length ?? 0) > 0) {
            const cssId = makeCssId(args)
            cssCache.set(args.path, makeStyle(compiled.css))
            compiled.js.code += `\nimport ${JSON.stringify(cssId)};\n`
          }

          // Svelte drops all `sourcesContent`, let'x fix them for esbuild to pick up.
          const sourcesContent: (string | null)[] = []
          for (const src of compiled.js.map.sources) {
            if (src === basename(filename)) {
              sourcesContent.push(source)
            } else {
              sourcesContent.push(null)
            }
          }
          // @ts-ignore Svelte uses `string[]` here, but actually it can have `null` items.
          compiled.js.map.sourcesContent = sourcesContent

          return {
            contents: makeCode(compiled.js),
            warnings: convertMessages(compiled.warnings, code, sourcemap),
            watchFiles,
          }
        } catch (err) {
          return { errors: convertMessages([err], code || source, sourcemap), watchFiles }
        }
      })

      build.onLoad({ filter: /\.svelte\.[cj]s(\?.*)?$/ }, async (args) => {
        const filename = relative(root, args.path).replaceAll('\\', '/')

        const code = await readFile(args.path, 'utf8')

        try {
          const compiled = compileModule(code, {
            ...compilerOptions,
            filename,
          })

          return { contents: makeCode(compiled.js), warnings: convertMessages(compiled.warnings, code) }
        } catch (err) {
          return { errors: convertMessages([err], code) }
        }
      })
    },
  }

  function convertMessages(messages: Warning[], code: string, sourcemap?: any): PartialMessage[] {
    return messages.map((e) => {
      if (e.start && e.end) {
        const lineText = code.split(/\r\n|\r|\n/g)[e.start.line - 1]
        const lineEnd = e.start.line === e.end.line ? e.end.column : lineText.length

        if (sourcemap) {
          sourcemap = new TraceMap(sourcemap)
          const pos = originalPositionFor(sourcemap, e.start)
          if (pos.source) {
            e.start.line = pos.line ?? e.start.line
            e.start.column = pos.column ?? e.start.column
          }
        }

        return {
          text: e.message,
          location: {
            file: e.filename,
            line: e.start.line,
            column: e.start.column,
            length: lineEnd - e.start.column,
            lineText,
          },
        }
      }

      return { text: e.message }
    })
  }

  function isInSsrMode(build: PluginBuild): boolean {
    const { define = {} } = build.initialOptions
    return define['import.meta.env.SSR'] == 'true'
  }

  function isInDevMode(build: PluginBuild): boolean {
    const { minify, define = {} } = build.initialOptions
    if (minify) return false
    if (isJsString(define['process.env.NODE_ENV'], 'production')) return false
    if (isJsString(define['import.meta.env.NODE_ENV'], 'production')) return false
    if (define['import.meta.env.DEV'] == 'false') return false
    return true
  }

  function isJsString(variable: string | undefined, value: string): boolean {
    return !!variable && (variable == `"${value}"` || variable == `'${value}'`)
  }

  function makeCssId(args: OnLoadArgs): string {
    const query = new URLSearchParams(args.suffix)
    query.set('svelte', '')
    query.set('type', 'style')
    query.set('lang.css', '')
    return './' + basename(args.path) + '?' + query.toString().replaceAll(/=(?=&|$)/g, '')
  }

  function makeStyle(css: { code: string; map: { toUrl(): string } } | null): string {
    if (!css) return ''
    return css.code + `\n/*# sourceMappingURL=${css.map.toUrl()} */\n`
  }

  function makeCode(js: { code: string; map: { toUrl(): string } } | null): string {
    if (!js) return ''
    return js.code + `\n//# sourceMappingURL=${js.map.toUrl()}`
  }
}

export { svelte as default }
