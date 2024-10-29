import { render } from 'svelte/server'
import { importFile } from '@hyrious/esbuild-dev'
import { svelte } from '../dist/index.js'

const dev = process.argv.includes('--dev')

const { default: App } = await importFile('./App.svelte', {
  plugins: [svelte()],
  define: {
    // For dev-ssr build, because svelte now depends on `esm-env` to choose the env,
    // the executor (node) should use [`--conditions=development`][1] to correctly run the dev component.
    // [1]: https://nodejs.org/api/packages.html#resolving-user-conditions
    'import.meta.env.DEV': dev ? 'true' : 'false',
    'import.meta.env.SSR': 'true'
  },
})

// The dev build will run some APIs like $inspect() which don't in prod build.
const { body } = render(App)
console.log(body)
