export type ColorTheme = 'light' | 'dark'

export function getScheduledTheme(date = new Date()): ColorTheme {
  const hour = date.getHours()
  return hour >= 6 && hour < 18 ? 'light' : 'dark'
}

export function getMillisecondsUntilThemeChange(date = new Date()): number {
  const nextChange = new Date(date)
  if (date.getHours() < 6) {
    nextChange.setHours(6, 0, 0, 0)
  } else if (date.getHours() < 18) {
    nextChange.setHours(18, 0, 0, 0)
  } else {
    nextChange.setDate(nextChange.getDate() + 1)
    nextChange.setHours(6, 0, 0, 0)
  }
  return nextChange.getTime() - date.getTime()
}
