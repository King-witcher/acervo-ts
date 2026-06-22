import { describe, expect, it } from 'bun:test'
import { yieldExecution } from './yield'

describe(yieldExecution, () => {
    it('allows pending setTimeout(0) callbacks to run before continuing', async () => {
        const order: string[] = []

        setTimeout(() => order.push('timeout'), 0)

        order.push('before')
        await yieldExecution()
        order.push('after')

        expect(order).toEqual(['before', 'timeout', 'after'])
    })

    it('allows multiple pending callbacks to run in order', async () => {
        const order: number[] = []

        setTimeout(() => order.push(1), 0)
        setTimeout(() => order.push(2), 0)
        setTimeout(() => order.push(3), 0)

        await yieldExecution()

        expect(order).toEqual([1, 2, 3])
    })

    it('does not run callbacks scheduled after the yield', async () => {
        const order: string[] = []

        await yieldExecution()
        setTimeout(() => order.push('late'), 0)

        expect(order).toEqual([])
    })
})
