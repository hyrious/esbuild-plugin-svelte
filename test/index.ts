import { build } from 'esbuild'
import { svelte } from '../src/index'

const { outputFiles } = await build({
  entryPoints: ['test/e2e.svelte'],
  bundle: true,
  plugins: [svelte({ emitCss: true })],
  outdir: 'dist',
  write: false,
  external: ['svelte'],
  sourcemap: true,
  format: 'esm',
  define: {
    'process.env.COUNT': '0',
  },
}).catch(() => process.exit(1))

let code!: string, map!: string
for (const { path, text } of outputFiles) {
  if (path.endsWith('.js')) code = text
  if (path.endsWith('.js.map')) map = text
}

const utf16ToUTF8 = (x) => unescape(encodeURIComponent(x))
code = utf16ToUTF8(code)
map = utf16ToUTF8(map)
console.log(
  'https://evanw.github.io/source-map-visualization/#' +
    btoa(code.length + '\0' + code + map.length + '\0' + map).replace(/\=+$/, ''),
)
