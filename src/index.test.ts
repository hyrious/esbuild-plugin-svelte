import { build } from 'esbuild'
import { svelte, typescript } from './index'

const dev = process.argv.includes('--dev')
const ssr = process.argv.includes('--ssr')

const { outputFiles } = await build({
  entryPoints: ['./fixture/App.svelte', './fixture/CustomElement.svelte'],
  bundle: true,
  format: 'esm',
  charset: 'utf8',
  plugins: [
    svelte({
      preprocess: typescript({ onwarn: false }),
      inspector: false,
    }),
  ],
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

const entries: {
  // `path` without '.map'
  [path: string]: { code: string; map: string }
} = {}

for (const { path, text } of outputFiles) {
  if (path.endsWith('.map')) {
    ;(entries[path.slice(0, -4)] ||= { code: '', map: '' }).map = text
  } else {
    ;(entries[path] ||= { code: '', map: '' }).code = text
  }
}

const _16to8 = (x: string) => unescape(encodeURIComponent(x))

for (const path in entries) {
  let { code, map } = entries[path]
  console.log()
  console.log('=====', path, '=====')
  console.log()
  console.log(code)
  console.log(map)
  ;[code, map] = [_16to8(code), _16to8(map)]

  let url =
    'https://evanw.github.io/source-map-visualization/#' +
    btoa(code.length + '\0' + code + map.length + '\0' + map).replace(/\=+$/, '')
  if (process.env.CI) {
    console.log(url)
  } else {
    console.log(`\x1b]8;;${url}\x1b\\source-map-visualization\x1b]8;;\x07`)
  }
}
