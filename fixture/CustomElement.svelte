<svelte:options customElement="my-element" />

<script>
  let { name = 'world' } = $props();
</script>

<h1>Hello {name}!</h1>
<slot />
