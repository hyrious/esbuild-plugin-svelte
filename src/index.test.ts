import { build } from 'esbuild'
import { svelte, typescript } from './index'

const dev = process.argv.includes('--dev')
const ssr = process.argv.includes('--ssr')

const { outputFiles } = await build({
  entryPoints: ['./fixture/App.svelte'],
  bundle: true,
  format: 'esm',
  charset: 'utf8',
  plugins: [svelte({ preprocess: typescript({ onwarn: false }) })],
  outdir: '.',
  write: false,
  packages: 'external',
  sourcemap: true,
  define: {
    'process.env.COUNT': '0',
    'process.env.NODE_ENV': dev ? '"development"' : '"production"',
    'import.meta.env.SSR': ssr ? 'true' : 'false',
  },
}).catch(() => process.exit(1))

let code!: string, map!: string
for (const { path, text } of outputFiles) {
  if (path.endsWith('.js')) code = text
  if (path.endsWith('.js.map')) map = text
}

console.log(code)
console.log(map)

const _16to8 = (x: string) => unescape(encodeURIComponent(x))
;[code, map] = [_16to8(code), _16to8(map)]

console.log(
  'https://evanw.github.io/source-map-visualization/#' +
    btoa(code.length + '\0' + code + map.length + '\0' + map).replace(/\=+$/, ''),
)
