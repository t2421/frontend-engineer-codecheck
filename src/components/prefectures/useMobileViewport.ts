import { onMounted, onScopeDispose, ref } from 'vue'

export function useMobileViewport() {
  const viewport =
    typeof matchMedia === 'function' ? matchMedia('(width < 640px)') : undefined
  const isMobile = ref(viewport?.matches ?? false)
  function update(event: MediaQueryListEvent) {
    isMobile.value = event.matches
  }
  onMounted(() => viewport?.addEventListener('change', update))
  onScopeDispose(() => viewport?.removeEventListener('change', update))
  return isMobile
}
