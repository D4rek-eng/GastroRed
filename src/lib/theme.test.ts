import { describe, expect, it } from 'vitest'
import { getMillisecondsUntilThemeChange, getScheduledTheme } from './theme'

describe('scheduled color theme', () => {
  it.each([
    ['05:59', 5, 59, 'dark'],
    ['06:00', 6, 0, 'light'],
    ['17:59', 17, 59, 'light'],
    ['18:00', 18, 0, 'dark'],
    ['23:00', 23, 0, 'dark'],
  ] as const)('selects the %s theme boundary', (_label, hour, minute, expected) => {
    const date = new Date(2026, 9, 11, hour, minute)
    expect(getScheduledTheme(date)).toBe(expected)
  })

  it('schedules the next transition at 6 am or 6 pm local time', () => {
    expect(getMillisecondsUntilThemeChange(new Date(2026, 9, 11, 5, 30))).toBe(30 * 60 * 1000)
    expect(getMillisecondsUntilThemeChange(new Date(2026, 9, 11, 12, 0))).toBe(6 * 60 * 60 * 1000)
    expect(getMillisecondsUntilThemeChange(new Date(2026, 9, 11, 20, 0))).toBe(10 * 60 * 60 * 1000)
  })
})
