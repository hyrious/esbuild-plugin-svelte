<script lang="ts">
  import External from "./External.svelte";
  let count: number = 1;
</script>

<button on:click={() => count++}>count: {count}</button>

<External />

<style>
  button {
    color: red;
  }
</style>
