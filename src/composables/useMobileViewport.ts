import { onScopeDispose, ref } from 'vue'

const mobileViewportQuery = '(width < 640px)'

function matchMobileViewport(): MediaQueryList | undefined {
  return typeof matchMedia === 'function'
    ? matchMedia(mobileViewportQuery)
    : undefined
}

export function useMobileViewport() {
  const viewport = matchMobileViewport()
  const isMobile = ref(viewport?.matches ?? false)
  const syncIsMobile = (event: MediaQueryListEvent) => {
    isMobile.value = event.matches
  }
  viewport?.addEventListener('change', syncIsMobile)
  onScopeDispose(() => viewport?.removeEventListener('change', syncIsMobile))
  return { isMobile }
}
