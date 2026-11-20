/**
 * findSunLongitude — the root-finder solar returns and equinox/solstice dates rely on.
 * Round-trip check (find a date from its own Sun longitude) rather than a fixed external
 * reference table: it validates the solver against calculatePosition() itself, which is
 * already validated to <0.01° against Swiss Ephemeris elsewhere in this package — so a
 * round-trip mismatch here would mean a solver bug, not a position bug.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { createAstronomyEngine, AstronomyEngineProvider, CelestialBody } from '../src'

describe('AstronomyEngine.findSunLongitude', () => {
  let engine: ReturnType<typeof createAstronomyEngine>

  beforeAll(() => {
    engine = createAstronomyEngine({ provider: new AstronomyEngineProvider() })
  })

  it('round-trips: searching for a date\'s own Sun longitude returns that date', async () => {
    const date = new Date('2026-08-24T12:00:00Z')
    const sunPos = await engine.getPosition(CelestialBody.Sun, date)
    const searchStart = new Date(date.getTime() - 5 * 86400000)
    const found = await engine.findSunLongitude(sunPos.longitude, searchStart, 10)
    expect(Math.abs(found.getTime() - date.getTime())).toBeLessThan(60000) // within 1 minute
  })

  it('round-trips across a birth date decades in the past', async () => {
    const date = new Date('1990-06-15T08:00:00Z')
    const sunPos = await engine.getPosition(CelestialBody.Sun, date)
    const searchStart = new Date(date.getTime() - 5 * 86400000)
    const found = await engine.findSunLongitude(sunPos.longitude, searchStart, 10)
    expect(Math.abs(found.getTime() - date.getTime())).toBeLessThan(60000)
  })

  it('the March 2026 equinox (Sun at 0°) falls on the well-known date', async () => {
    // Public reference (US Naval Observatory / USNO): 2026 March equinox is 2026-03-20 ~08:46 UTC.
    const found = await engine.findSunLongitude(0, new Date('2026-03-15T00:00:00Z'), 20)
    expect(found.toISOString().slice(0, 10)).toBe('2026-03-20')
  })

  it('throws when the target longitude cannot occur within the search window', async () => {
    await expect(
      engine.findSunLongitude(0, new Date('2026-01-01T00:00:00Z'), 5)
    ).rejects.toThrow('Sun longitude not found in search window')
  })
})
