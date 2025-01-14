import {
  BuildOptions,
  Message,
  OnLoadArgs,
  PartialMessage,
  Plugin,
  PluginBuild,
  TransformOptions,
} from 'esbuild'
import { readFile } from 'node:fs/promises'
import { basename, relative } from 'node:path'
import { createServer, RequestListener, Server } from 'node:http'
import {
  preprocess,
  compile,
  compileModule,
  PreprocessorGroup,
  CompileOptions,
  Warning,
  ModuleCompileOptions,
} from 'svelte/compiler'
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping'
import { Options } from '../node_modules/@sveltejs/vite-plugin-svelte-inspector/src/public'
import { defaultInspectorOptions, inspector, loader } from './inspector'

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
  /// Enable svelte inspector during development.
  inspector?: boolean | Options
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

  const inspectorOptions: false | Options =
    (options.inspector ??= true) === false
      ? false
      : options.inspector === true
        ? defaultInspectorOptions
        : { ...defaultInspectorOptions, ...options.inspector }
  let waitLaunchEditorService = Promise.resolve<Server | null>(null)
  let onDispose = true
  let transformOptions: TransformOptions | undefined

  if (emitCss) compilerOptions.css ??= 'external'

  return {
    name: 'svelte',
    setup(build) {
      const root = process.cwd()
      let injectInspector = false

      compilerOptions.dev ??= isInDevMode(build)
      compilerOptions.generate ??= isInSsrMode(build) ? 'server' : 'client'

      build.onEnd(() => {
        cssCache.clear()
        transformOptions = undefined
      })

      if (compilerOptions.dev && compilerOptions.generate === 'client' && inspectorOptions) {
        injectInspector = true
        onDispose && build.onDispose(setupLaunchEditorService())
        build.initialOptions.conditions ??= ['development']

        build.onResolve({ filter: /^virtual:svelte-inspector-path:.*/ }, (args) => {
          const filename = args.path.replace('virtual:svelte-inspector-path:', '')
          return { path: filename, namespace: 'svelte-inspector' }
        })

        build.onResolve({ filter: /^virtual:svelte-inspector-options$/ }, () => {
          return { path: 'options.js', namespace: 'svelte-inspector' }
        })

        build.onLoad({ filter: /.*/, namespace: 'svelte-inspector' }, async (args) => {
          if (args.path == 'options.js') {
            await waitLaunchEditorService
            return { contents: JSON.stringify(inspectorOptions), loader: 'json' }
          }
          if (args.path == 'load-inspector.js') {
            return { contents: loader, loader: 'default', resolveDir: root }
          }
          if (args.path == 'Inspector.svelte') {
            const compiled = compile(inspector, {
              dev: true,
              generate: 'client',
              css: 'injected',
              filename: args.path,
            })
            return { contents: makeCode(compiled.js), loader: 'js', resolveDir: root }
          }
        })
      }

      build.onLoad({ filter }, async (args) => {
        const filename = relative(root, args.path).replaceAll('\\', '/')

        const query = new URLSearchParams(args.suffix)
        if (query.has('svelte') && query.get('type') == 'style') {
          const css = cssCache.get(args.path)
          cssCache.delete(args.path)
          if (css) return { contents: css, loader: 'css' }
          else return { errors: [{ text: 'CSS not found' }] }
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

          const compileOptions = { ...compilerOptions }
          if (options.dynamicCompileOptions) {
            const changes = await options.dynamicCompileOptions({ filename, code, compileOptions })
            if (changes) Object.assign(compileOptions, changes)
          }

          const compiled = compile(code, {
            ...compileOptions,
            filename,
            sourcemap,
          })

          if (emitCss && (compiled.css?.code.trim().length ?? 0) > 0) {
            const cssId = makeCssId(args)
            cssCache.set(args.path, makeStyle(compiled.css))
            compiled.js.code += `\nimport ${JSON.stringify(cssId)};\n`
          }

          // Svelte drops all `sourcesContent`, let's fix them for esbuild to pick up.
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
            contents: makeCode(compiled.js, injectInspector),
            warnings: convertMessages(compiled.warnings, code, sourcemap),
            watchFiles,
          }
        } catch (err) {
          return { errors: convertMessages([err], code || source, sourcemap), watchFiles }
        }
      })

      build.onLoad({ filter: /\.svelte\.[jt]s(\?.*)?$/ }, async (args) => {
        const filename = relative(root, args.path).replaceAll('\\', '/')

        let code = await readFile(args.path, 'utf8')

        try {
          // `compileModule` only accepts JavaScript even though svelte depends on `acorn-typescript`.
          // https://github.com/sveltejs/svelte/blob/68cffa8/packages/svelte/src/compiler/index.js#L67
          // So we need to transform TypeScript sources here. :/
          let transformWarnings: PartialMessage[] = []
          if (args.path.includes('.svelte.ts')) {
            const transformOptions = getTransformOptions(build)
            const result = await build.esbuild.transform(code, { ...transformOptions, sourcefile: filename })
            transformWarnings = result.warnings
            code = result.code
          }

          const compileOptions = getModuleCompileOptions(compilerOptions)

          const compiled = compileModule(code, {
            ...compileOptions,
            filename,
          })

          return {
            contents: makeCode(compiled.js),
            warnings: transformWarnings.concat(convertMessages(compiled.warnings, code)),
          }
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

  function getModuleCompileOptions({
    dev,
    generate,
    filename,
    rootDir,
    warningFilter,
  }: CompileOptions): ModuleCompileOptions {
    return { dev, generate, filename, rootDir, warningFilter }
  }

  function getTransformOptions(build: PluginBuild): TransformOptions {
    if (transformOptions) return transformOptions
    const {
      bundle,
      splitting,
      preserveSymlinks,
      outfile,
      metafile,
      outdir,
      outbase,
      external,
      packages,
      alias,
      loader,
      resolveExtensions,
      mainFields,
      conditions,
      write,
      allowOverwrite,
      tsconfig,
      outExtension,
      publicPath,
      entryNames,
      chunkNames,
      assetNames,
      inject,
      banner,
      footer,
      entryPoints,
      stdin,
      plugins,
      absWorkingDir,
      nodePaths,
      ...transformOptions_
    } = build.initialOptions
    transformOptions = transformOptions_
    transformOptions.loader = 'ts'
    transformOptions.sourcemap = 'inline'
    return transformOptions
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

  function makeCode(
    js: { code: string; map: { toUrl(): string } } | null,
    injectInspector?: boolean,
  ): string {
    if (!js) return ''
    // The inspector loader is injected to all JS results returned from this plugin.
    // It should be ok since they are importing the same module, hence the module cache works.
    const injected = injectInspector ? `\nimport('virtual:svelte-inspector-path:load-inspector.js')` : ''
    return js.code + `${injected}\n//# sourceMappingURL=${js.map.toUrl()}\n`
  }

  function setupLaunchEditorService(): () => void {
    onDispose = false
    waitLaunchEditorService = new Promise((resolve, reject) => {
      import('launch-editor-middleware').then((mod) => {
        const handler: RequestListener = mod.default()
        const server = createServer(cors(handler))
        server.listen(0, 'localhost', () => {
          const { port } = server.address() as any
          Object.assign(inspectorOptions, { __internal: { base: `http://localhost:${port}` } })
          resolve(server)
        })
        server.on('error', (err) => console.error(err))
      }, reject)
    })
    return () => waitLaunchEditorService.then((server) => server?.close())
  }

  function cors(handler: RequestListener): RequestListener {
    return (req, res) => {
      res.setHeader('access-control-allow-origin', '*')
      return handler(req, res)
    }
  }
}
