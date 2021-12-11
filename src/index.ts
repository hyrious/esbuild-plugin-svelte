import { Plugin } from "esbuild";
import { CompileOptions } from "svelte/types/compiler/interfaces";
import { PreprocessorGroup } from "svelte/types/compiler/preprocess";
import { typescript } from "./typescript";
import { version } from "../package.json";

export { version, typescript };

export interface Options {
  configFile?: string;
  filter?: RegExp;
  preprocess?: PreprocessorGroup | PreprocessorGroup[];
  /**
   * @default false
   */
  emitCss?: boolean;
  compilerOptions?: CompileOptions;
}

// https://esbuild.github.io/plugins/#svelte-plugin
export function svelte(options?: Options): Plugin {
  options ??= {};
  options.filter ??= /\.svelte$/;
  options.preprocess ??= [];
  if (!Array.isArray(options.preprocess)) {
    options.preprocess = [options.preprocess];
  }
  options.preprocess = [...options.preprocess, typescript()];

  return {
    name: "svelte",
    setup({ onLoad }) {},
  };
}
