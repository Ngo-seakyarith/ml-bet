/**
 * Hero icons in src/assets/heroes, one file per hero named by slug
 * ("Lapu-Lapu" → lapu-lapu.png, "Chang'e" → chang-e.png). Sources are listed
 * in sources.json next to them.
 */
const files = import.meta.glob<string>('../assets/heroes/*.png', { eager: true, query: '?url', import: 'default' })

const byslug = new Map<string, string>()
for (const [path, url] of Object.entries(files)) {
  const name = path.split('/').pop()!.replace(/\.png$/, '')
  byslug.set(name, url)
}

export function heroSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Icon URL for a hero name, or null when there is no picture for it. */
export function heroImage(name: string): string | null {
  return byslug.get(heroSlug(name)) ?? null
}
