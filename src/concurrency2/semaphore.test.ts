import { describe, expect, it } from 'bun:test'
import { yieldExecution } from '@/utils/utils'
import { Semaphore } from './semaphore'

describe(Semaphore, () => {
    it('immediately acquires when slots are available', async () => {
        const sem = new Semaphore(3)
        const slots = await Promise.all([sem.acquire(), sem.acquire(), sem.acquire()])
        expect(slots).toHaveLength(3)
        for (const s of slots) s.release()
    })

    it('blocks acquire when at capacity', async () => {
        const sem = new Semaphore(1)
        const slot = await sem.acquire()
        let acquired = false

        sem.acquire().then((s) => {
            acquired = true
            s.release()
        })

        await yieldExecution()
        expect(acquired).toBe(false)

        slot.release()
        await yieldExecution()
        expect(acquired).toBe(true)
    })

    it('serves waiters in FIFO order', async () => {
        const sem = new Semaphore(1)
        const slot = await sem.acquire()
        const order: number[] = []

        const p1 = sem.acquire().then((s) => {
            order.push(1)
            s.release()
        })
        const p2 = sem.acquire().then((s) => {
            order.push(2)
            s.release()
        })
        const p3 = sem.acquire().then((s) => {
            order.push(3)
            s.release()
        })

        slot.release()
        await Promise.all([p1, p2, p3])

        expect(order).toEqual([1, 2, 3])
    })

    it('withSlot releases the slot after function resolves', async () => {
        const sem = new Semaphore(1)
        await sem.withSlot(async () => {})

        let acquired = false
        sem.acquire().then((s) => {
            acquired = true
            s.release()
        })
        await yieldExecution()

        expect(acquired).toBe(true)
    })

    it('withSlot releases the slot even when function throws', async () => {
        const sem = new Semaphore(1)
        await expect(
            sem.withSlot(async () => {
                throw new Error('boom')
            }),
        ).rejects.toThrow('boom')

        let acquired = false
        sem.acquire().then((s) => {
            acquired = true
            s.release()
        })
        await yieldExecution()

        expect(acquired).toBe(true)
    })

    it('withSlot propagates the return value of the function', async () => {
        const sem = new Semaphore(1)
        const result = await sem.withSlot(async () => 42)
        expect(result).toBe(42)
    })

    it('throws on double release', async () => {
        const sem = new Semaphore(1)
        const slot = await sem.acquire()
        slot.release()
        expect(() => slot.release()).toThrow()
    })

    it('[Symbol.dispose] releases the slot', async () => {
        const sem = new Semaphore(1)
        const slot = await sem.acquire()
        slot[Symbol.dispose]()

        let acquired = false
        sem.acquire().then((s) => {
            acquired = true
            s.release()
        })
        await yieldExecution()

        expect(acquired).toBe(true)
    })

    it('createChildSemaphore capacity is capped at current available parent slots', () => {
        const parent = new Semaphore(2)
        const child = parent.createChildSemaphore(10)
        expect(child.capacity).toBe(2)
    })

    it('createChildSemaphore respects the requested capacity when smaller than parent', () => {
        const parent = new Semaphore(5)
        const child = parent.createChildSemaphore(2)
        expect(child.capacity).toBe(2)
    })

    it('child semaphore holds a parent slot while its slot is acquired', async () => {
        const parent = new Semaphore(1)
        const child = parent.createChildSemaphore(1)
        const childSlot = await child.acquire()

        // Parent should be fully occupied now
        let parentAcquired = false
        parent.acquire().then((s) => {
            parentAcquired = true
            s.release()
        })
        await yieldExecution()
        expect(parentAcquired).toBe(false)

        // Releasing child should also free the parent slot
        childSlot.release()
        await yieldExecution()
        expect(parentAcquired).toBe(true)
    })

    it('multiple acquires and releases maintain correct slot count', async () => {
        const sem = new Semaphore(3)
        const s1 = await sem.acquire()
        const s2 = await sem.acquire()
        const s3 = await sem.acquire()

        let blocked = false
        sem.acquire().then((s) => {
            blocked = true
            s.release()
        })
        await yieldExecution()
        expect(blocked).toBe(false)

        s1.release()
        await yieldExecution()
        expect(blocked).toBe(true)

        s2.release()
        s3.release()
    })
})
