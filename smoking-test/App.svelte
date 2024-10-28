<script lang="ts">
  import Item from './nested/Item.svelte'
  import { count } from './nested/shared-state.svelte'

  let inc = () => count.value++
  $inspect(count.value)
</script>

<button onclick={inc}>{count.value}</button>
<Item />

<style>
  button {
    color: red
  }
</style>
