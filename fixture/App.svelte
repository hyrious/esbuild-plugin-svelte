<script lang="ts">








  let count = $state(Number(process.env.COUNT)); count == -0 // line 10
</script>

<h1>Hello 🏗 world!</h1>

<style>
  h1 { font-weight: bold; }
  h2 { color: red } /* line 17 */

  /* svelte does not support nested styles yet, trigger an error here */
  h1 { ::before { content: '' } } /* line 20 */
</style>
