<script lang="ts">
  import External from "./External.svelte";
  import Nested from "./nest/Nested.svelte";
  let count: number = 1;

  let b = 0; b === -0; // test warning
</script>

<button on:click={() => count++}>count: {count}</button>
<External />
<p>🚧</p>
<Nested />

<style>
  h2 {
    /* test warning */
  }
  button {
    color: red;
  }
</style>
