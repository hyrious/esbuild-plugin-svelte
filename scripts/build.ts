import fs from 'node:fs'
import cp from 'node:child_process'
import * as c from 'yoctocolors'
import * as esbuild from 'esbuild'
import * as rollup from 'rollup'
import pkg from '../package.json'

fs.rmSync('dist', { recursive: true, force: true })

let start = Date.now()
let bundle = await rollup.rollup({
  input: 'src/index.ts',
  plugins: [
    {
      name: 'esbuild',
      async load(id) {
        const { outputFiles } = await esbuild.build({
          entryPoints: [id],
          bundle: true,
          platform: 'node',
          format: 'esm',
          outfile: 'src/index.js',
          sourcemap: true,
          write: false,
          target: ['node14.18', 'node16'],
          external: Object.keys({
            ...pkg.dependencies,
            ...pkg.peerDependencies,
          }),
        })
        let code!: string, map!: string
        for (const file of outputFiles) {
          if (file.path.endsWith('.map')) {
            map = file.text
          } else {
            code = file.text
          }
        }
        return { code, map }
      },
    },
  ],
  treeshake: 'smallest',
  external: /^[@a-z]/,
})

await Promise.all([
  bundle.write({
    file: 'dist/index.mjs',
    format: 'es',
    sourcemap: true,
    sourcemapExcludeSources: true,
  }),
  bundle.write({
    file: 'dist/index.js',
    format: 'cjs',
    sourcemap: true,
    exports: 'named',
    sourcemapExcludeSources: true,
  }),
])

await bundle.close()
console.log(c.bgYellow(c.black('  JS ')), 'Built JS files in', Date.now() - start + 'ms')

let npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
cp.spawnSync(npx, ['dts', '-o', 'dist/index.d.ts'], { stdio: 'inherit' })
