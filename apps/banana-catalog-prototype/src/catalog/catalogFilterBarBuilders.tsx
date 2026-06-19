import type { ReactNode } from 'react'
import type { CatalogFilterBarChipOption } from './CatalogFilterBar'
import { sutraClassName, sutraFilterChipClassName } from './sutraTheme'
import { sutraQuestionFromDisplay } from './sutraContext'
import type { FacetEntry } from './types'

export function facetEntriesToToggleChips(args: {
  groupId: string
  entries: FacetEntry[]
  isSutra?: boolean
  isActive: (value: string) => boolean
  onToggle: (value: string) => void
  countLabel: string
}): CatalogFilterBarChipOption[] {
  return args.entries.map(({ value, count }) => {
    const active = args.isActive(value)
    const disabled = !active && count === 0
    const label: ReactNode = args.isSutra ? (
      <span className={`catalog-facet-sutra-name ${sutraClassName(value)}`}>{value}</span>
    ) : (
      value
    )
    return {
      id: `${args.groupId}-${value}`,
      label,
      count,
      active,
      disabled,
      className: args.isSutra ? sutraFilterChipClassName(value) : undefined,
      onClick: () => args.onToggle(value),
      title: args.isSutra
        ? `${sutraQuestionFromDisplay(value)} (${count} ${args.countLabel})`
        : `${count} ${args.countLabel}`,
    }
  })
}

/** Single-select facet row (muses, quotes, LP sutra/genre). */
export function singleSelectFacetChips(args: {
  groupId: string
  options: readonly { value: string; label: ReactNode; count: number }[]
  activeValue: string
  allValue?: string
  onSelect: (value: string) => void
  showCount?: boolean
  chipClassName?: (value: string) => string | undefined
}): CatalogFilterBarChipOption[] {
  const allValue = args.allValue ?? 'all'
  return args.options.map(({ value, label, count }) => {
    const active = args.activeValue === value
    const disabled = !active && count === 0 && value !== allValue
    return {
      id: `${args.groupId}-${value}`,
      label,
      count,
      active,
      disabled,
      showCount: args.showCount,
      className: args.chipClassName?.(value),
      onClick: () => args.onSelect(value),
      title: args.showCount === false ? undefined : `${count}`,
    }
  })
}

export function linkFacetChip(args: {
  id: string
  label: ReactNode
  href: string
  count: number
  active: boolean
  disabled?: boolean
  title?: string
  className?: string
}): CatalogFilterBarChipOption {
  return {
    id: args.id,
    label: args.label,
    href: args.href,
    count: args.count,
    active: args.active,
    disabled: args.disabled,
    title: args.title,
    className: args.className,
  }
}
