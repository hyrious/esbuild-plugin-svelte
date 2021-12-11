<script lang="ts" context="module">
  export const name = "example";
</script>

<script lang="ts">
  let count: number = 0;
</script>

<button on:click={() => count++}>
  [{name}] count: {count}
</button>
