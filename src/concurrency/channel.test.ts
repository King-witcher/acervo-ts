import { describe, expect, it } from 'bun:test'
import { yieldExecution } from '@/utils/utils'
import { Channel, ChannelClosedException } from './channel'
import { Semaphore } from './semaphore'

describe(Channel, () => {
    // ── Basic send / receive ───────────────────────────────────────────────

    it('delivers data from sender to receiver', async () => {
        const ch = new Channel<number>()
        ch.send(1) // fire-and-forget
        const value = await ch.receive()
        expect(value).toBe(1)
    })

    it('sender waits until a receiver is ready', async () => {
        const ch = new Channel<number>()
        let received: number | undefined

        ch.receive().then((v) => {
            received = v
        })

        await yieldExecution()
        expect(received).toBeUndefined()

        await ch.send(42)
        expect(received).toBe(42)
    })

    it('receive() waits when no data is available', async () => {
        const ch = new Channel<number>()
        let received: number | undefined

        ch.receive().then((v) => {
            received = v
        })
        await yieldExecution()
        expect(received).toBeUndefined()

        await ch.send(99)
        expect(received).toBe(99)
    })

    it('preserves insertion order for multiple sends', async () => {
        const ch = new Channel<number>()
        ch.send(1)
        ch.send(2)
        ch.send(3)
        await yieldExecution()

        expect(await ch.receive()).toBe(1)
        expect(await ch.receive()).toBe(2)
        expect(await ch.receive()).toBe(3)
    })

    it('length reflects the number of pending unread senders', async () => {
        const ch = new Channel<number>()
        const s1 = ch.send(1)
        const s2 = ch.send(2)

        await Promise.resolve() // allow semaphore acquire microtasks to settle
        expect(ch.length).toBe(2)

        await ch.receive()
        expect(ch.length).toBe(1)

        await ch.receive()
        expect(ch.length).toBe(0)

        await s1
        await s2
    })

    // ── Bounded channel ────────────────────────────────────────────────────

    it('bounded channel blocks sender when at capacity', async () => {
        const ch = new Channel<number>(1)
        const s1 = ch.send(1)
        await yieldExecution() // let s1 queue

        let s2Done = false
        ch.send(2).then(() => {
            s2Done = true
        })
        await yieldExecution()
        expect(s2Done).toBe(false) // blocked — channel is full

        await ch.receive() // free a slot
        await yieldExecution()
        await yieldExecution()
        expect(s2Done).toBe(true)

        await ch.receive()
        await s1
    })

    /**
     * BUG: send() acquires a semaphore slot for every call, but never releases it
     * when there is already a waiting receiver (direct delivery path). This leaks a
     * slot for each direct delivery, eventually blocking all future sends.
     *
     * This test will FAIL until the bug is fixed.
     */
    it('bounded channel: releases slot when delivering directly to a waiting receiver', async () => {
        const sem = new Semaphore(1)
        const ch = new Channel<number>(sem)

        const receivePromise = ch.receive() // receiver is waiting

        await ch.send(1) // should deliver directly and release the slot
        expect(await receivePromise).toBe(1)

        // Second send must not block — the slot from the first send should be free
        let sent2 = false
        ch.send(2).then(() => {
            sent2 = true
        })
        await yieldExecution()
        await yieldExecution()
        expect(sent2).toBe(true) // FAILS if slot was leaked
    })

    // ── close() ───────────────────────────────────────────────────────────

    it('close() rejects pending receivers with ChannelClosedException', async () => {
        const ch = new Channel<number>()
        const p = ch.receive()
        ch.close()
        await expect(p).rejects.toBeInstanceOf(ChannelClosedException)
    })

    it('close() prevents new sends', async () => {
        const ch = new Channel<number>()
        ch.close()
        await expect(ch.send(1)).rejects.toBeInstanceOf(ChannelClosedException)
    })

    it('close() prevents new receives when empty', async () => {
        const ch = new Channel<number>()
        ch.close()
        await expect(ch.receive()).rejects.toBeInstanceOf(ChannelClosedException)
    })

    it('close() does not lose items already queued in senders', async () => {
        const ch = new Channel<number>()
        ch.send(1)
        ch.send(2)
        await yieldExecution()

        expect(await ch.receive()).toBe(1)
        expect(await ch.receive()).toBe(2)

        ch.close()
        await expect(ch.receive()).rejects.toBeInstanceOf(ChannelClosedException)
    })

    // ── iter / asyncIterator / collect ────────────────────────────────────

    it('iter() yields all items and stops when channel is closed', async () => {
        const ch = new Channel<number>()
        const collected: number[] = []

        const consuming = (async () => {
            for await (const item of ch.iter()) {
                collected.push(item)
            }
        })()

        await ch.send(1)
        await ch.send(2)
        await ch.send(3)
        ch.close()
        await consuming

        expect(collected).toEqual([1, 2, 3])
    })

    it('[Symbol.asyncIterator] is equivalent to iter()', async () => {
        const ch = new Channel<number>()
        const collected: number[] = []

        const consuming = (async () => {
            for await (const item of ch) {
                collected.push(item)
            }
        })()

        await ch.send(10)
        await ch.send(20)
        ch.close()
        await consuming

        expect(collected).toEqual([10, 20])
    })

    it('collect() returns all items sent before close', async () => {
        const ch = new Channel<number>()
        const collecting = ch.collect()

        await ch.send(1)
        await ch.send(2)
        await ch.send(3)
        ch.close()

        expect(await collecting).toEqual([1, 2, 3])
    })
})
