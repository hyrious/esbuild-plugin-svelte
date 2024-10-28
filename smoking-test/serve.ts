import { context } from 'esbuild'
import { svelte } from '../dist/index.js'

let ctx = await context({
  entryPoints: ['./main.ts'],
  bundle: true,
  format: 'esm',
  outfile: './bundle.js',
  logLevel: 'info',
  write: false,
  plugins: [svelte()],
  sourcemap: true,
})

await ctx.serve({
  host: 'localhost',
  servedir: '.',
})

process.on('SIGINT', async () => {
  await ctx.dispose()
  process.exit(0)
})

process.stdin.setEncoding('utf8')
process.stdin.on('data', async (data: string) => {
  if (data.trim() == 'q') {
    await ctx.dispose()
    process.exit(0)
  }
})
