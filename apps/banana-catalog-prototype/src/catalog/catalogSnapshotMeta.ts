import buildSummaryJson from '../data/generated/_build_summary.json'

export const CATALOG_SNAPSHOT_DATE = (buildSummaryJson as { snapshot_date?: string }).snapshot_date ?? ''

export function formatCatalogSnapshotDate(isoDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate
  const d = new Date(`${isoDate}T12:00:00`)
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(d)
}
