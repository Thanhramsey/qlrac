export function resolveMediaUrl(rawUrl?: string | null) {
  if (!rawUrl) {
    return undefined
  }

  const normalizedUrl = rawUrl.trim()
  if (!normalizedUrl) {
    return undefined
  }

  if (
    normalizedUrl.startsWith('http://') ||
    normalizedUrl.startsWith('https://') ||
    normalizedUrl.startsWith('data:') ||
    normalizedUrl.startsWith('blob:')
  ) {
    return normalizedUrl
  }

  if (normalizedUrl.startsWith('/uploads/')) {
    return `/api${normalizedUrl}`
  }

  return normalizedUrl
}
