import { build } from 'esbuild'
import { svelte } from '../src/index'

const { outputFiles } = await build({
  entryPoints: ['test/e2e.svelte'],
  bundle: true,
  plugins: [svelte({ emitCss: true })],
  outdir: 'dist',
  write: false,
  external: ['svelte'],
  format: 'esm',
  define: {
    'process.env.COUNT': '0',
  },
}).catch(() => process.exit(1))

for (const { path, text } of outputFiles) {
  console.log('=====', path, '=====')
  console.log(text)
}
