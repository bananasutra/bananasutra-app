import type { MuseCatalogItem } from './types'

export type MuseFilterState = {
  era: string
  gender: string
  type: string
  country: string
  query: string
}

export function splitMuseList(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

export function normalizeMuseSearch(value: string): string {
  return value.trim().toLowerCase()
}

export function museMatchesFilters(row: MuseCatalogItem, f: MuseFilterState): boolean {
  const eraOk = f.era === 'all' || splitMuseList(row.era).includes(f.era)
  const genderOk = f.gender === 'all' || row.gender_pronoun === f.gender
  const typeOk = f.type === 'all' || splitMuseList(row.type_category).includes(f.type)
  const countryOk = f.country === 'all' || row.country.trim() === f.country
  const searchOk =
    !f.query ||
    [
      row.muse,
      row.type_category,
      row.country,
      row.era,
      row.themes,
      row.famous_works,
      row.notes,
      row.quote_excerpt,
    ].some((value) => normalizeMuseSearch(value).includes(f.query))
  return eraOk && genderOk && typeOk && countryOk && searchOk
}

export function buildContextualMuseRows(rows: MuseCatalogItem[], filters: MuseFilterState) {
  const rowsWithoutEra = rows.filter((row) =>
    museMatchesFilters(row, { ...filters, era: 'all' }),
  )
  const rowsWithoutGender = rows.filter((row) =>
    museMatchesFilters(row, { ...filters, gender: 'all' }),
  )
  const rowsWithoutType = rows.filter((row) =>
    museMatchesFilters(row, { ...filters, type: 'all' }),
  )
  const rowsWithoutCountry = rows.filter((row) =>
    museMatchesFilters(row, { ...filters, country: 'all' }),
  )
  return { rowsWithoutEra, rowsWithoutGender, rowsWithoutType, rowsWithoutCountry }
}
