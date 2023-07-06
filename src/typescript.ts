import type { PartialMessage, PluginBuild, TransformOptions } from 'esbuild'
import type { PreprocessorGroup } from 'svelte/compiler'

import { formatMessages, transform, version } from 'esbuild'
import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { basename, dirname, resolve } from 'path'
import { WriteStream } from 'tty'

type CompilerOptions = NonNullable<
  Exclude<TransformOptions['tsconfigRaw'], string | undefined>['compilerOptions']
>

export interface TypeScriptOptions {
  compilerOptions?: CompilerOptions
  esbuild?: PluginBuild['esbuild']
  onwarn?: (message: PartialMessage, defaultHandler?: (message: PartialMessage) => void) => void
}

export function typescript(options: TypeScriptOptions = {}): PreprocessorGroup {
  const onwarn = options.onwarn
  const warn = onwarn ? (message: PartialMessage) => onwarn(message, defaultHandler) : defaultHandler
  const compile = options.esbuild?.transform ?? transform

  return {
    async script({ attributes: { lang, src }, content, filename = 'source.svelte' }) {
      if (lang !== 'ts') return

      let dependencies: string[] | undefined
      let sourcefile = basename(filename)
      if (typeof src === 'string') {
        const resolved = resolve(dirname(filename), src)
        if (existsSync(resolved)) {
          content = await readFile(resolved, 'utf8')
          dependencies = [resolved]
          sourcefile = src
        } else {
          warn({
            text: `Could not find ${JSON.stringify(src)} from ${JSON.stringify(filename)}`,
            location: { file: filename },
          })
        }
      }

      const { code, map, warnings } = await compile(content, {
        loader: 'ts',
        sourcefile,
        sourcemap: 'external',
        tsconfigRaw: {
          compilerOptions: Object.assign(
            defaultCompilerOptions(options.esbuild?.version ?? version),
            options.compilerOptions,
          ),
        },
      })

      for (const w of warnings) {
        warn(w)
      }

      return { code, map, dependencies }
    },
  }
}

function defaultCompilerOptions(version?: string): CompilerOptions {
  if (version) {
    const [major, minor] = version.split('.')
    if (Number(major) === 0 && Number(minor) < 18) {
      return { preserveValueImports: true }
    }
  }
  return { verbatimModuleSyntax: true }
}

async function defaultHandler(message: string | PartialMessage | PartialMessage[]) {
  message = typeof message === 'string' ? [{ text: message }] : makeArray(message)
  const result = await formatMessages(message, {
    kind: 'warning',
    color: WriteStream.prototype.hasColors(),
    terminalWidth: process.stderr.columns,
  })
  for (const string of result) {
    console.warn(string)
  }
}

export function makeArray<T>(a: T | T[]): T[] {
  return Array.isArray(a) ? a : [a]
}
