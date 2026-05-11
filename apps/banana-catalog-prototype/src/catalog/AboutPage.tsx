import { AboutContent } from './AboutContent'
import { AboutSutrasContent } from './AboutSutrasContent'
import { AboutTabLayout } from './AboutTabLayout'
import { MuseCardGrid } from './MuseCardGrid'
import { QuoteWall } from './QuoteWall'
import './CatalogApp.css'
import './AboutPage.css'

export function AboutPage() {
  return (
    <AboutTabLayout>
      <AboutContent />
    </AboutTabLayout>
  )
}

export function AboutSutrasPage() {
  return (
    <AboutTabLayout>
      <AboutSutrasContent />
    </AboutTabLayout>
  )
}

export function AboutMusesPage() {
  return (
    <AboutTabLayout>
      <MuseCardGrid />
    </AboutTabLayout>
  )
}

export function AboutQuotesPage() {
  return (
    <AboutTabLayout>
      <QuoteWall />
    </AboutTabLayout>
  )
}
