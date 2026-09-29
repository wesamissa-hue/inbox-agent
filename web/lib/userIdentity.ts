export function displayNameFromEmail(email: string | null | undefined): string {
  const localPart = email?.split('@', 1)[0]?.trim()
  if (!localPart) return 'User'

  const words = localPart.replace(/[._]+/g, ' ').split(/\s+/).filter(Boolean)
  const name = words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')

  return name || 'User'
}

export function initialsFromName(name: string | null | undefined): string {
  const words = (name || 'User').trim().split(/\s+/).filter(Boolean)
  const initials = words.slice(0, 2).map((word) => Array.from(word)[0]?.toUpperCase() || '').join('')
  return initials || 'U'
}
