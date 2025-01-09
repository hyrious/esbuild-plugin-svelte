/// <reference types="svelte" />
export const count = $state({ value: 0 })

// Test TypeScript.
type A = number & { readonly __brand: unique symbol }
const a = 1 as A
