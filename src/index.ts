import { Plugin } from "esbuild";
import { CompileOptions } from "svelte/types/compiler/interfaces";
import { PreprocessorGroup } from "svelte/types/compiler/preprocess";
import { version } from "../package.json";

export { version };

export interface Options {
  configFile?: string;
  filter?: RegExp;
  preprocess?: PreprocessorGroup | PreprocessorGroup[];
  emitCss?: boolean;
  compilerOptions?: CompileOptions;
}

// https://esbuild.github.io/plugins/#svelte-plugin
export function svelte(options?: Options): Plugin {
  options ??= {};
  options.filter ??= /\.svelte$/;
  options.preprocess ??= [];
  if (Array.isArray(options.preprocess)) {
    options.preprocess = [...options.preprocess];
  } else {
    options.preprocess = [options.preprocess];
  }

  return {
    name: "svelte",
    setup({ onLoad }) {},
  };
}
