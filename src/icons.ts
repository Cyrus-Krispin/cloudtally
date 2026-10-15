// Official AWS Architecture Icons, named after each service's `type`.
// Source: https://aws.amazon.com/architecture/icons/ (July 2026 release).
const files = import.meta.glob<string>('./assets/aws/*.svg', { eager: true, query: '?url', import: 'default' })

export const iconByType: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.split('/').pop()!.replace('.svg', ''), url]),
)
