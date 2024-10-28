import { formatMessages, PartialMessage, transform, TransformOptions } from 'esbuild'
import { PreprocessorGroup } from 'svelte/compiler'
import { WriteStream } from 'node:tty'
import { basename, normalize } from 'node:path'

export type CompilerOptions = NonNullable<
  Exclude<TransformOptions['tsconfigRaw'], string | undefined>['compilerOptions']
>

export interface TypeScriptOptions {
  /// Passed to esbuild transform options `tsconfigRaw`.
  compilerOptions?: CompilerOptions
  /// If not set, warnings will be printed to the console.
  /// If set to `false`, all warnings will be suppressed.
  /// This is useful when passing the result to esbuild because it will print warnings on the final result.
  onwarn?: boolean | ((message: PartialMessage, defaultHandler?: (message: PartialMessage) => void) => void)
}

/**
 * Use `esbuild` to preprocess `<script lang="ts">` blocks.
 *
 * ```js
 * svelte({ preprocess: [typescript()] })
 * ```
 */
export function typescript(options: TypeScriptOptions = {}): PreprocessorGroup {
  options.onwarn ??= true

  return {
    async script({ attributes, content, filename = '' }) {
      if (attributes.lang != 'ts') return

      const base = basename(filename)
      const file = normalize(filename).replaceAll('\\', '/')

      const { code, map, warnings } = await transform(content, {
        loader: 'ts',
        charset: 'utf8',
        // Svelte only handles basename even though it feeds relative path into preprocessor.
        // But this config also affects esbuild warnings, let's fix them later.
        sourcefile: base,
        sourcemap: 'external',
        tsconfigRaw: {
          compilerOptions: {
            verbatimModuleSyntax: true,
            ...options.compilerOptions,
          },
        },
      })

      const messages: PartialMessage[] = []
      const defaultWarn = (warning: PartialMessage) => messages.push(warning)

      for (const warning of warnings) {
        if (warning.location?.file === base) warning.location.file = file
        if (options.onwarn) {
          if (typeof options.onwarn == 'function') options.onwarn(warning, defaultWarn)
          else defaultWarn(warning)
        }
      }

      if (messages.length > 0) {
        const outputs = await formatMessages(messages, {
          kind: 'warning',
          color: WriteStream.prototype.hasColors(),
          terminalWidth: process.stderr.columns,
        })
        for (const output of outputs) console.warn(output)
      }

      return { code, map }
    },
  }
}
