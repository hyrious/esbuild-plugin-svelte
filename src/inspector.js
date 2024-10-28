export const defaultInspectorOptions = {
  toggleKeyCombo: 'alt-x',
  navKeys: { parent: 'ArrowUp', child: 'ArrowDown', next: 'ArrowRight', prev: 'ArrowLeft' },
  escapeKeys: ['Backspace', 'Escape'],
  openKey: 'Enter',
  holdMode: true,
  showToggleButton: 'active',
  toggleButtonPos: 'top-right',
  customStyles: true,
}

export { default as inspector } from '../node_modules/@sveltejs/vite-plugin-svelte-inspector/src/runtime/Inspector.svelte?raw'
export { default as loader } from '../node_modules/@sveltejs/vite-plugin-svelte-inspector/src/runtime/load-inspector.js?raw'
