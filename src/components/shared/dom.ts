export function isRendered(element: Element): boolean {
  return element.getClientRects().length > 0
}
