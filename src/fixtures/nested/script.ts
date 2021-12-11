// isolated modules will be unhappy
export type {};
// unused, who knows?
let count: number = 0;
// trigger esbuild warning
if (count === -0) {
  console.log("!");
}
