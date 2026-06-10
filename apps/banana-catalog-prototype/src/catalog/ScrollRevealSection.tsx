import type { ComponentPropsWithoutRef, ElementType } from 'react'
import { useScrollReveal } from './useScrollReveal'

type ScrollRevealSectionProps<T extends ElementType = 'section'> = {
  immediate?: boolean
  as?: T
} & ComponentPropsWithoutRef<T>

/**
 * Shell section with viewport fade-up (prototype `.learn-carry` pattern).
 * Pass `immediate` for the first above-fold block; near-fold sections auto-show on load.
 */
export function ScrollRevealSection<T extends ElementType = 'section'>({
  immediate = false,
  as,
  className,
  children,
  ...rest
}: ScrollRevealSectionProps<T>) {
  const Tag = (as ?? 'section') as ElementType
  const { ref, visible } = useScrollReveal(immediate)
  const classes = [
    'catalog-page-shell__section',
    'catalog-scroll-reveal',
    visible ? 'is-visible' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Tag ref={ref} className={classes} {...rest}>
      {children}
    </Tag>
  )
}
