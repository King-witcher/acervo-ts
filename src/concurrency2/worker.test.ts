import { describe, expect, it } from 'bun:test'
import { yieldExecution } from '@/utils/utils'
import { Semaphore } from './semaphore'
import { Worker } from './worker'

describe(Worker, () => {
    // ── Basic processing ───────────────────────────────────────────────────

    it('processes all items from an array and sends results to output', async () => {
        const sem = new Semaphore(1)
        const worker = new Worker<number, number>({
            semaphore: sem,
            workerFn: async (n) => [n * 2],
        })

        worker.digest([1, 2, 3]).then(() => worker.output.close())
        const results = await worker.output.collect()

        expect(results.sort((a, b) => a - b)).toEqual([2, 4, 6])
    })

    it('resolves immediately when source is empty', async () => {
        const sem = new Semaphore(2)
        const worker = new Worker<number, number>({
            semaphore: sem,
            workerFn: async (n) => [n],
        })

        await expect(worker.digest([])).resolves.toBeUndefined()
    })

    it('supports workerFn returning multiple outputs per item', async () => {
        const sem = new Semaphore(1)
        const worker = new Worker<number, number>({
            semaphore: sem,
            workerFn: async (n) => [n, n * 10],
        })

        worker.digest([1, 2]).then(() => worker.output.close())
        const results = await worker.output.collect()

        expect(results.sort((a, b) => a - b)).toEqual([1, 2, 10, 20])
    })

    it('supports workerFn returning an empty array (items are filtered)', async () => {
        const sem = new Semaphore(1)
        const worker = new Worker<number, number>({
            semaphore: sem,
            workerFn: async (n) => (n % 2 === 0 ? [n] : []),
        })

        worker.digest([1, 2, 3, 4]).then(() => worker.output.close())
        const results = await worker.output.collect()

        expect(results.sort((a, b) => a - b)).toEqual([2, 4])
    })

    // ── Source types ──────────────────────────────────────────────────────

    it('processes items from a sync Generator', async () => {
        const sem = new Semaphore(1)
        const worker = new Worker<number, number>({
            semaphore: sem,
            workerFn: async (n) => [n * 10],
        })

        function* gen() {
            yield 1
            yield 2
            yield 3
        }

        worker.digest(gen()).then(() => worker.output.close())
        const results = await worker.output.collect()

        expect(results.sort((a, b) => a - b)).toEqual([10, 20, 30])
    })

    it('processes items from an AsyncGenerator', async () => {
        const sem = new Semaphore(1)
        const worker = new Worker<number, number>({
            semaphore: sem,
            workerFn: async (n) => [n * 10],
        })

        async function* asyncGen() {
            yield 1
            yield 2
            yield 3
        }

        worker.digest(asyncGen()).then(() => worker.output.close())
        const results = await worker.output.collect()

        expect(results.sort((a, b) => a - b)).toEqual([10, 20, 30])
    })

    // ── Concurrency ───────────────────────────────────────────────────────

    it('runs up to semaphore capacity concurrently', async () => {
        const capacity = 3
        const sem = new Semaphore(capacity)
        let peak = 0
        let running = 0

        const worker = new Worker<number, number>({
            semaphore: sem,
            workerFn: async (n) => {
                running++
                peak = Math.max(peak, running)
                await yieldExecution()
                running--
                return [n]
            },
        })

        await worker.digest([1, 2, 3, 4, 5, 6])

        expect(peak).toBe(capacity)
    })

    it('never exceeds semaphore capacity', async () => {
        const capacity = 2
        const sem = new Semaphore(capacity)
        let exceeded = false
        let running = 0

        const worker = new Worker<number, number>({
            semaphore: sem,
            workerFn: async (n) => {
                running++
                if (running > capacity) exceeded = true
                await yieldExecution()
                running--
                return [n]
            },
        })

        await worker.digest([1, 2, 3, 4, 5, 6, 7, 8])

        expect(exceeded).toBe(false)
    })

    // ── Error handling ────────────────────────────────────────────────────

    it('rejects with the error thrown by workerFn', async () => {
        const sem = new Semaphore(1)
        const worker = new Worker<number, number>({
            semaphore: sem,
            workerFn: async (n) => {
                if (n === 2) throw new Error('worker failed')
                return [n]
            },
        })

        await expect(worker.digest([1, 2, 3])).rejects.toThrow('worker failed')
    })

    it('stops processing new items after an error', async () => {
        const sem = new Semaphore(1)
        const processed: number[] = []

        const worker = new Worker<number, number>({
            semaphore: sem,
            workerFn: async (n) => {
                processed.push(n)
                if (n === 2) throw new Error('abort')
                return [n]
            },
        })

        await expect(worker.digest([1, 2, 3, 4, 5])).rejects.toThrow('abort')

        // Items after the error should not be processed
        expect(processed).not.toContain(3)
        expect(processed).not.toContain(4)
        expect(processed).not.toContain(5)
    })

    /**
     * BUG: when `abort` is true the worker does `if (abort) break` AFTER acquiring
     * a semaphore slot but BEFORE the try/finally block. The break therefore skips
     * the finally, and slot.release() is never called, permanently leaking a slot.
     *
     * This test will FAIL until the bug is fixed.
     */
    it('does not leak semaphore slots when aborting after an error', async () => {
        const sem = new Semaphore(1)
        const worker = new Worker<number, number>({
            semaphore: sem,
            workerFn: async (n) => {
                if (n === 1) throw new Error('fail')
                return [n]
            },
        })

        // Item 2 and 3 will trigger the abort path (abort=true + break before try)
        await expect(worker.digest([1, 2, 3])).rejects.toThrow('fail')

        // If slots were leaked, this acquire would block forever
        let acquired = false
        sem.acquire().then((s) => {
            acquired = true
            s.release()
        })
        await yieldExecution()

        expect(acquired).toBe(true) // FAILS if a slot was leaked
    })
})
