import { onMounted, onScopeDispose, onUpdated, ref, type Ref } from 'vue'

export function useFloatingSelection(
  selector: Ref<HTMLElement | null>,
  population: Ref<HTMLElement | null>,
) {
  const visible = ref(false)
  const isMobile = ref(false)
  const scrollSpace = ref(0)
  let observer: ResizeObserver | undefined
  function update() {
    isMobile.value = window.innerWidth < 640
    const selectionRect = selector.value?.getBoundingClientRect()
    const graphRect = population.value?.getBoundingClientRect()
    visible.value = Boolean(
      isMobile.value &&
      selectionRect &&
      graphRect &&
      selectionRect.bottom <= 0 &&
      graphRect.bottom > 0 &&
      graphRect.top < window.innerHeight,
    )
    scrollSpace.value = Math.max(
      0,
      window.innerHeight - (graphRect?.height ?? 0),
    )
  }
  onMounted(() => {
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(update)
      if (selector.value) observer.observe(selector.value)
      if (population.value) observer.observe(population.value)
    }
  })
  onScopeDispose(() => {
    window.removeEventListener('scroll', update)
    window.removeEventListener('resize', update)
    observer?.disconnect()
  })
  onUpdated(update)
  return { visible, isMobile, scrollSpace }
}
