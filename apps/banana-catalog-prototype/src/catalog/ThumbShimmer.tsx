import './thumbShimmer.css'

type Props = {
  className?: string
}

/** Placeholder sweep while cover art loads. Pair with a positioned parent. */
export function ThumbShimmer({ className }: Props) {
  const classes = ['thumb-shimmer', className].filter(Boolean).join(' ')
  return <span className={classes} aria-hidden />
}
