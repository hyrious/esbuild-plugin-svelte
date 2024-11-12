import { statSync } from 'fs'
import { build } from 'esbuild'
import { rollup } from 'rollup'
import svelte from '../dist/index.js'

const fmt = new Intl.NumberFormat()
const stat = (path: string, message: string) => {
  const size = statSync(path).size
  console.log(path + message, fmt.format(size / 1024), 'kB')
  return size
}

await build({
  entryPoints: ['./main.ts'],
  bundle: true,
  format: 'esm',
  outdir: 'dist',
  logLevel: 'info',
  plugins: [svelte()],
  define: { 'import.meta.env.DEV': 'false' },
}).catch(() => process.exit(1))

let file = './dist/main.js'
stat(file, '')

// Loop doing { rollup(output), esbuild(output) } to the fixed point.
let message = ''
let size = Infinity
let nextSize = 0

while (true) {
  // One iteration's output is very close to Vite's output.
  // Vite basically does: prebunding node_modules (esbuild) -> rollup sources -> esbuild minify.
  await (await rollup({ input: file, treeshake: true })).write({ file })
  stat(file, (message += ' - rollup'))

  await build({ entryPoints: [file], minifySyntax: true, outfile: file, allowOverwrite: true })
  nextSize = stat(file, (message += ' - esbuild'))

  if (size <= nextSize) break
  size = nextSize
}
