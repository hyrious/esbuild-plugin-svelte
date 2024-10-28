import { Plugin } from 'esbuild'
import { readFile } from 'fs/promises'
import { join } from 'path'

export default <Plugin>{
  name: 'raw',
  setup({ onResolve, onLoad }) {
    onResolve({ filter: /\?raw$/ }, (args) => {
      return { path: join(args.resolveDir, args.path) }
    })

    onLoad({ filter: /\?raw$/ }, async (args) => {
      const contents = await readFile(args.path.replace(/[?#].*$/s, ''))
      return { contents, loader: 'text' }
    })
  },
}
