<script lang="ts" context="module">
  export const name = "example2";
</script>

<script lang="ts" src="./nested/script.ts">
  // code bellow will never be used
  // it's here just for svelte vsc extension not yell
  let count2: any;
  console.log("I' will never be executed");
</script>

<button on:click={() => count2++}>
  [{name}] count: {count2}
</button>
