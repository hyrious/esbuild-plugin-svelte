import { build } from 'esbuild'
import { external } from '@hyrious/esbuild-plugin-external'
import raw from './esbuild-plugin-raw'

await build({
  entryPoints: ['./src/index.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outdir: 'dist',
  logLevel: 'info',
  plugins: [raw, external()],
}).catch(() => process.exit(1))
