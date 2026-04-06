import { describe, expect, it } from 'bun:test'
import { yieldExecution } from '@/utils/utils'
import { Signal } from './signal'

describe(Signal, () => {
    it('resolves wait() after signal() is called', async () => {
        const sig = new Signal()
        let resolved = false

        sig.wait().then(() => {
            resolved = true
        })

        expect(resolved).toBe(false)
        sig.signal()
        await yieldExecution()
        expect(resolved).toBe(true)
    })

    it('wait() resolves even if signal() was called before wait()', async () => {
        const sig = new Signal()
        sig.signal()
        await expect(sig.wait()).resolves.toBeUndefined()
    })

    it('rejects wait() when fail() is called', async () => {
        const sig = new Signal()
        const error = new Error('test error')

        const p = sig.wait()
        sig.fail(error)

        await expect(p).rejects.toThrow('test error')
    })

    it('fail() rejects wait() even if called before wait()', async () => {
        const sig = new Signal()
        const error = new Error('early fail')
        sig.fail(error)
        await expect(sig.wait()).rejects.toThrow('early fail')
    })

    it('multiple awaits on the same signal all resolve', async () => {
        const sig = new Signal()
        const results: number[] = []

        sig.wait().then(() => results.push(1))
        sig.wait().then(() => results.push(2))
        sig.wait().then(() => results.push(3))

        sig.signal()
        await yieldExecution()

        expect(results).toEqual([1, 2, 3])
    })
})
