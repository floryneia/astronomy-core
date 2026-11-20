/**
 * astronomy-core Position Tests
 * Validates celestial position calculations
 */

import { describe, it, expect, beforeAll } from 'vitest'
import {
  createAstronomyEngine,
  AstronomyEngineProvider,
  CelestialBody,
  CalculatedPoint,
} from '../src'

describe('AstronomyEngine', () => {
  let engine: ReturnType<typeof createAstronomyEngine>

  beforeAll(() => {
    const provider = new AstronomyEngineProvider()
    engine = createAstronomyEngine({ provider })
  })

  describe('Position Calculation', () => {
    it('should calculate Sun position on J2000 epoch', async () => {
      const date = new Date('2000-01-01T12:00:00.000Z')
      const sun = await engine.getSun(date)

      expect(sun.body).toBe(CelestialBody.Sun)
      expect(sun.longitude).toBeGreaterThanOrEqual(0)
      expect(sun.longitude).toBeLessThan(360)
      expect(sun.latitude).not.toBeNull()
      expect(sun.distance).toBeGreaterThan(0.98) // AU, near perihelion
      expect(sun.distance).toBeLessThan(1.02)
      expect(sun.timestamp).toEqual(date)
    })

    it('should calculate Moon position', async () => {
      const date = new Date('2025-07-31T12:00:00.000Z')
      const moon = await engine.getMoon(date)

      expect(moon.body).toBe(CelestialBody.Moon)
      expect(moon.longitude).toBeGreaterThanOrEqual(0)
      expect(moon.longitude).toBeLessThan(360)
      expect(moon.latitude).not.toBeNull()
      expect(moon.distance).toBeGreaterThan(0.0025) // AU, in range
      expect(moon.distance).toBeLessThan(0.0027)
    })

    it('should calculate Mars position', async () => {
      const date = new Date('2025-01-15T00:00:00.000Z')
      const mars = await engine.getPosition(CelestialBody.Mars, date)

      expect(mars.body).toBe(CelestialBody.Mars)
      expect(mars.longitude).toBeGreaterThanOrEqual(0)
      expect(mars.longitude).toBeLessThan(360)
      expect(mars.distance).toBeGreaterThan(0.37) // Mars geocentric range: ~0.37-2.68 AU
      expect(mars.distance).toBeLessThan(2.68)
    })

    it('should calculate North Node position', async () => {
      const date = new Date('2025-07-31T12:00:00.000Z')
      const node = await engine.getPosition(CalculatedPoint.TrueNorthNode, date)

      expect(node.body).toBe(CalculatedPoint.TrueNorthNode)
      expect(node.longitude).toBeGreaterThanOrEqual(0)
      expect(node.longitude).toBeLessThan(360)
      expect(node.latitude).toBe(0) // Nodes are on the ecliptic plane
      expect(node.distance).toBeNull() // Calculated point
    })

    it('should calculate South Node as opposite of North Node', async () => {
      const date = new Date('2025-07-31T12:00:00.000Z')
      const northNode = await engine.getPosition(CalculatedPoint.TrueNorthNode, date)
      const southNode = await engine.getPosition(CalculatedPoint.TrueSouthNode, date)

      const expectedSouthLon = (northNode.longitude + 180) % 360
      expect(southNode.longitude).toBeCloseTo(expectedSouthLon, 1)
    })
  })

  describe('Batch Operations', () => {
    it('should calculate multiple bodies efficiently', async () => {
      const date = new Date('2025-07-31T12:00:00.000Z')
      const bodies = [CelestialBody.Sun, CelestialBody.Moon, CelestialBody.Mars]
      const positions = await engine.getPositions(bodies, date)

      expect(positions).toHaveLength(3)
      expect(positions[0].body).toBe(CelestialBody.Sun)
      expect(positions[1].body).toBe(CelestialBody.Moon)
      expect(positions[2].body).toBe(CelestialBody.Mars)
      positions.forEach((pos) => {
        expect(pos.timestamp).toEqual(date)
      })
    })

    it('should calculate all bodies', async () => {
      const date = new Date('2025-07-31T12:00:00.000Z')
      const allBodies = await engine.getAllBodies(date)

      expect(allBodies.length).toBe(18) // 15 physical + 3 calculated points
      allBodies.forEach((pos) => {
        expect(pos.longitude).toBeGreaterThanOrEqual(0)
        expect(pos.longitude).toBeLessThan(360)
        expect(pos.timestamp).toEqual(date)
      })
    })
  })

  describe('Determinism', () => {
    it('should return same result for same inputs (determinism test)', async () => {
      const date = new Date('2025-07-31T12:00:00.000Z')
      const sun1 = await engine.getSun(date)
      const sun2 = await engine.getSun(date)

      expect(sun1.longitude).toBe(sun2.longitude)
      expect(sun1.latitude).toBe(sun2.latitude)
      expect(sun1.distance).toBe(sun2.distance)
      expect(sun1.speed).toBe(sun2.speed)
    })
  })

  describe('Date Validation', () => {
    it('should reject invalid dates', async () => {
      const invalidDate = new Date('invalid')
      await expect(engine.getSun(invalidDate)).rejects.toThrow()
    })

    it('should work with ISO UTC dates', async () => {
      const date = new Date('2025-07-31T00:00:00.000Z')
      const sun = await engine.getSun(date)
      expect(sun).toBeDefined()
      expect(sun.longitude).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Type Safety', () => {
    it('should enforce body type enum', async () => {
      const date = new Date('2025-07-31T12:00:00.000Z')
      // These should compile without error
      const sun = await engine.getPosition(CelestialBody.Sun, date)
      const node = await engine.getPosition(CalculatedPoint.TrueNorthNode, date)

      expect(sun).toBeDefined()
      expect(node).toBeDefined()
    })
  })
})
