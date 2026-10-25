import type { ImgHTMLAttributes } from 'react'

type UnoptimizedImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  unoptimized?: boolean
}

export default function UnoptimizedImage({
  alt = '',
  unoptimized: _unoptimized,
  ...props
}: UnoptimizedImageProps) {
  // This project has legacy SPA image markup with CSS-driven dimensions. Keeping a plain
  // img preserves that behavior while avoiding Next/Image's required width/height contract.
  // eslint-disable-next-line @next/next/no-img-element
  return <img alt={alt} {...props} />
}
