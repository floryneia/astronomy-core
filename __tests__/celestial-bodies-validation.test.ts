/**
 * Celestial Bodies Validation — against Swiss Ephemeris 2.10.03
 * Reference values measured 2026-07-31. Do not modify without re-running validation.
 * See: packages/astronomy-core/celestial-bodies-validation.json
 *
 * Bug documented: atan2(gv.y, gv.x) gives equatorial RA (1-3° error).
 * Fix: Astronomy.Ecliptic(gv).elon → max <0.003° (inner), <0.005° (outer) vs Swiss Ephemeris.
 *
 * Tolerance: ±0.005° inner planets / Moon / Sun; ±0.006° outer planets (Uranus/Neptune/Pluto).
 * Neptune max measured at 0.00497° — slightly wider tolerance for slow bodies.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { AstronomyEngineProvider } from '../src/providers/AstronomyEngineProvider'
import { CelestialBody } from '../src/types'

function circularDiff(a: number, b: number): number {
  const diff = Math.abs(a - b)
  return Math.min(diff, 360 - diff)
}

// Swiss Ephemeris reference values (swe.calc_ut, geocentric ecliptic tropical, noon UTC)
const FIXTURES: Record<string, Record<string, number>> = {
  '1990-03-20T12:00:00Z': { Sun: 359.6141, Moon: 279.7049, Mercury: 0.9884,   Venus: 313.5569, Mars: 306.5519, Jupiter: 91.7159,  Saturn: 293.6991, Uranus: 279.3341, Neptune: 284.3737, Pluto: 227.5433 },
  '1995-07-04T12:00:00Z': { Sun: 102.0600, Moon: 175.6938, Mercury: 80.9565,  Venus: 89.0501,  Mars: 170.3071, Jupiter: 246.8002, Saturn: 354.7493, Uranus: 299.1720, Neptune: 294.5027, Pluto: 238.1418 },
  '2000-01-01T12:00:00Z': { Sun: 280.3689, Moon: 223.3238, Mercury: 271.8893, Venus: 241.5658, Mars: 327.9633, Jupiter: 25.2530,  Saturn: 40.3956,  Uranus: 314.8092, Neptune: 303.1930, Pluto: 251.4547 },
  '2005-06-21T12:00:00Z': { Sun: 90.2079,  Moon: 260.7718, Mercury: 109.4521, Venus: 111.7980, Mars: 6.4804,   Jupiter: 189.3206, Saturn: 116.8605, Uranus: 340.7476, Neptune: 317.3312, Pluto: 262.9853 },
  '2010-09-01T12:00:00Z': { Sun: 158.9518, Moon: 66.2648,  Mercury: 162.8411, Venus: 204.2058, Mars: 201.1339, Jupiter: 0.9298,   Saturn: 184.1765, Uranus: 359.3953, Neptune: 326.9713, Pluto: 272.8314 },
  '2015-01-15T12:00:00Z': { Sun: 295.0039, Moon: 229.0672, Mercury: 313.8863, Venus: 314.8680, Mars: 332.4020, Jupiter: 140.4180, Saturn: 242.2331, Uranus: 12.8286,  Neptune: 335.7857, Pluto: 283.6689 },
  '2020-06-01T12:00:00Z': { Sun: 71.4507,  Moon: 192.8870, Mercury: 94.7008,  Venus: 74.9961,  Mars: 343.0299, Jupiter: 296.7375, Saturn: 301.5934, Uranus: 38.5850,  Neptune: 350.8326, Pluto: 294.6845 },
  '2025-01-15T12:00:00Z': { Sun: 295.5890, Moon: 134.6883, Mercury: 280.3256, Venus: 342.6581, Mars: 116.4542, Jupiter: 71.9495,  Saturn: 345.7525, Uranus: 53.3621,  Neptune: 357.5536, Pluto: 301.5222 },
}

const INNER_BODIES: Record<string, CelestialBody> = {
  Sun: CelestialBody.Sun, Moon: CelestialBody.Moon,
  Mercury: CelestialBody.Mercury, Venus: CelestialBody.Venus,
  Mars: CelestialBody.Mars, Jupiter: CelestialBody.Jupiter, Saturn: CelestialBody.Saturn,
}

const OUTER_BODIES: Record<string, CelestialBody> = {
  Uranus: CelestialBody.Uranus, Neptune: CelestialBody.Neptune, Pluto: CelestialBody.Pluto,
}

describe('Celestial Bodies vs Swiss Ephemeris', () => {
  let provider: AstronomyEngineProvider

  beforeAll(() => {
    provider = new AstronomyEngineProvider()
  })

  for (const [iso, refs] of Object.entries(FIXTURES)) {
    for (const [bodyName, refLon] of Object.entries(refs)) {
      const isOuter = bodyName in OUTER_BODIES
      const body = isOuter ? OUTER_BODIES[bodyName] : INNER_BODIES[bodyName]
      // Outer planets use ±0.006° vs ±0.005° for inner bodies.
      // Neptune observed max residual: 0.00497° — likely from long-period orbital calculation
      // differences between Astronomy Engine and Swiss Ephemeris ephemeris bases, not a bug.
      const tolerance = isOuter ? 0.006 : 0.005

      it(`${bodyName} at ${iso.slice(0, 10)} within ±${tolerance}° of Swiss Ephemeris`, async () => {
        const pos = await provider.getPosition(body, new Date(iso))
        expect(circularDiff(pos.longitude, refLon)).toBeLessThan(tolerance)
      })
    }
  }
})
