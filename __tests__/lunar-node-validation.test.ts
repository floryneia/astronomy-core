/**
 * Lunar Node Validation — against Swiss Ephemeris 2.10.03 (swe.TRUE_NODE)
 * Reference values measured 2026-07-31. Do not modify without re-running validation.
 * See: packages/astronomy-core/lunar-node-validation.json
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { AstronomyEngineProvider } from '../src/providers/AstronomyEngineProvider'
import { CalculatedPoint } from '../src/types'

function circularDiff(a: number, b: number): number {
  const diff = Math.abs(a - b)
  return Math.min(diff, 360 - diff)
}

const FIXTURES = [
  { date: '2000-01-01T12:00:00Z', se_lon: 123.9529 },
  { date: '2005-06-29T12:00:00Z', se_lon: 19.4589 },
  { date: '2010-01-01T12:00:00Z', se_lon: 291.0818 },
  { date: '2013-05-10T12:00:00Z', se_lon: 226.8645 },
  { date: '2020-01-01T12:00:00Z', se_lon: 98.3828 },
  { date: '2023-03-01T12:00:00Z', se_lon: 35.8075 },
]

describe('Lunar Node vs Swiss Ephemeris', () => {
  let provider: AstronomyEngineProvider

  beforeAll(() => {
    provider = new AstronomyEngineProvider()
  })

  it.each(FIXTURES)('TrueNorthNode at $date within ±0.02° of Swiss Ephemeris', async ({ date, se_lon }) => {
    const pos = await provider.getPosition(CalculatedPoint.TrueNorthNode, new Date(date))
    const error = circularDiff(pos.longitude, se_lon)
    expect(error).toBeLessThan(0.02)
  })

  it('South Node is exactly North Node + 180° (10 dates, 35-year span)', async () => {
    // toBe(0) is exact because South is derived from North via (north + 180) % 360.
    // If South Node is ever computed independently, replace with circularDiff < 0.001°.
    const dates = [
      '1990-01-01T12:00:00Z', '1995-06-15T12:00:00Z', '2000-01-01T12:00:00Z',
      '2003-09-20T12:00:00Z', '2007-03-15T12:00:00Z', '2010-07-04T12:00:00Z',
      '2015-01-01T12:00:00Z', '2018-11-13T12:00:00Z', '2022-04-01T12:00:00Z',
      '2025-01-15T12:00:00Z',
    ]
    for (const iso of dates) {
      const date = new Date(iso)
      const north = await provider.getPosition(CalculatedPoint.TrueNorthNode, date)
      const south = await provider.getPosition(CalculatedPoint.TrueSouthNode, date)
      const expected = (north.longitude + 180) % 360
      expect(circularDiff(south.longitude, expected)).toBe(0)
    }
  })

  it('retrograde motion: longitude decreases every month at physically coherent rate', async () => {
    // True Node oscillates around Mean Node (~19°/year = ~1.6°/month average).
    // Monthly motion ranges from ~0.05° to ~3.5° due to libration (half-anomalistic period ~14d).
    // Bounds catch: stuck value, constant output, wrong units, sign inversion.
    // Wrap 359°→0° handled by circular formula.
    const longitudes: number[] = []
    for (let m = 1; m <= 12; m++) {
      const iso = `2020-${String(m).padStart(2, '0')}-15T12:00:00Z`
      const pos = await provider.getPosition(CalculatedPoint.TrueNorthNode, new Date(iso))
      longitudes.push(pos.longitude)
    }
    for (let i = 1; i < longitudes.length; i++) {
      const delta = longitudes[i] - longitudes[i - 1]
      const circular = delta > 180 ? delta - 360 : delta < -180 ? delta + 360 : delta
      expect(circular).toBeLessThan(-0.05)  // retrograde (not stuck or prograde)
      expect(circular).toBeGreaterThan(-4)  // not runaway (wrong units or wraparound bug)
    }
  })

  it('works on extreme historical and future dates (1700–2100)', async () => {
    const extremes = [
      '1700-06-01T12:00:00Z',
      '1800-01-01T12:00:00Z',
      '1900-07-04T12:00:00Z',
      '2050-01-01T12:00:00Z',
      '2100-12-31T12:00:00Z',
    ]
    for (const iso of extremes) {
      const pos = await provider.getPosition(CalculatedPoint.TrueNorthNode, new Date(iso))
      expect(pos.longitude).toBeGreaterThanOrEqual(0)
      expect(pos.longitude).toBeLessThan(360)
    }
  })
})
