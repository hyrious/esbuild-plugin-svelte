import { build } from 'esbuild'
import raw from './esbuild-plugin-raw'

await build({
  entryPoints: ['./src/index.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outdir: 'dist',
  packages: 'external',
  logLevel: 'info',
  plugins: [raw],
}).catch(() => process.exit(1))
