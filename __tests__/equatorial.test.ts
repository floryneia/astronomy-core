/**
 * Right ascension & declination, validated against Swiss Ephemeris (pyswisseph 2.10.3.2,
 * swe.calc_ut(..., FLG_EQUATORIAL)) — real independent reference, not a self cross-check.
 * Generated 2026-08-22. Max observed gap across all 9 cases: 0.0015° (Uranus/Sydney);
 * assertions below use 0.01° as a ceiling with headroom, not the measured precision.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { createAstronomyEngine, AstronomyEngineProvider, CelestialBody, CalculatedPoint } from '../src'

describe('AstronomyEngine.getEquatorial', () => {
  let engine: ReturnType<typeof createAstronomyEngine>

  beforeAll(() => {
    engine = createAstronomyEngine({ provider: new AstronomyEngineProvider() })
  })

  const paris = new Date('2000-01-01T12:00:00.000Z')
  const sydney = new Date('2026-08-22T00:00:00.000Z')

  const cases: Array<{ label: string; date: Date; body: CelestialBody; ra: number; dec: number }> = [
    { label: 'Sun, Paris',      date: paris,  body: CelestialBody.Sun,     ra: 281.2784, dec: -23.0324 },
    { label: 'Moon, Paris',     date: paris,  body: CelestialBody.Moon,    ra: 222.4522, dec: -10.9006 },
    { label: 'Mercury, Paris',  date: paris,  body: CelestialBody.Mercury, ra: 272.0746, dec: -24.4189 },
    { label: 'Jupiter, Paris',  date: paris,  body: CelestialBody.Jupiter, ra: 23.8678,  dec: 8.5943 },
    { label: 'Pluto, Paris',    date: paris,  body: CelestialBody.Pluto,   ra: 251.4191, dec: -11.3943 },
    { label: 'Sun, Sydney',     date: sydney, body: CelestialBody.Sun,     ra: 151.079,  dec: 11.8408 },
    { label: 'Moon, Sydney',    date: sydney, body: CelestialBody.Moon,    ra: 258.2724, dec: -27.9884 },
    { label: 'Saturn, Sydney',  date: sydney, body: CelestialBody.Saturn,  ra: 14.0641,  dec: 3.1785 },
    { label: 'Uranus, Sydney',  date: sydney, body: CelestialBody.Uranus,  ra: 63.6478,  dec: 21.0731 },
  ]

  it.each(cases)('matches Swiss Ephemeris within 0.01° — $label', async ({ date, body, ra, dec }) => {
    const eq = await engine.getEquatorial(body, date)
    expect(Math.abs(eq.rightAscension - ra)).toBeLessThan(0.01)
    expect(Math.abs(eq.declination - dec)).toBeLessThan(0.01)
  })

  it('lunar node equatorial coords stay in valid ranges', async () => {
    const eq = await engine.getEquatorial(CalculatedPoint.TrueNorthNode, paris)
    expect(eq.rightAscension).toBeGreaterThanOrEqual(0)
    expect(eq.rightAscension).toBeLessThan(360)
    expect(eq.declination).toBeGreaterThanOrEqual(-90)
    expect(eq.declination).toBeLessThanOrEqual(90)
  })
})
