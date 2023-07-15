import { suite } from 'uvu'
import * as assert from 'uvu/assert'
import validate from 'sourcemap-validator'
import { typescript, type TypeScriptOptions } from './typescript'
import { readFile } from 'fs/promises'
import { compile, preprocess } from 'svelte/compiler'
import { basename } from 'path'

const ts = suite('typescript')

const compile_file = async (filename: string, options?: TypeScriptOptions) => {
  const source = await readFile(filename, 'utf-8')
  const processor = typescript(options)
  const processed = await preprocess(source, processor, { filename })
  const { js } = compile(processed.code, {
    sourcemap: processed.map,
    filename,
    dev: true,
  })
  assert.equal(js.map.sources, [basename(filename)])
  js.map.sources[0] = filename
  assert.not.throws(() => {
    validate(js.code, js.map, { [filename]: source })
  })
}

ts('should generate correct sourcemap', async () => {
  await compile_file('./test/example.svelte')
})

ts('should work with `src`', async () => {
  const filename = './test/src-nested.svelte'
  await compile_file(filename, {
    onwarn(message) {
      assert.match(message.text!, 'Comparison with -0 using the')
    },
  })
})

ts('should yell at not founding `src`', async () => {
  const filename = './test/src-not-found.svelte'
  await compile_file(filename, {
    onwarn(message) {
      assert.is(message.location?.file, filename)
    },
  })
})

ts('should not process scripts without `lang=ts`', async () => {
  const filename = './test/not-ts.svelte'
  await compile_file(filename)
})

ts.run()
