import { Signal } from '@/async/signal2'
import { yieldExecution } from '@/utils/utils'
import type { IChannel } from './ichannel'

/**
 * A bounded channel that limits the number of items that can be queued.
 * If the channel reaches its capacity, senders are blocked until space is available.
 */
export class BoundedChannel<T> implements IChannel<T> {
    private signals: Signal[] = []

    constructor(
        private decoree: IChannel<T>,
        private capacity: number,
    ) {}

    get length(): number {
        return this.decoree.length
    }

    /**
     * Sends data to the channel.
     * If the channel is at maximum capacity, the sender waits until space is available.
     * Otherwise, returns immediately after sending the data.
     */
    async send(data: T): Promise<void> {
        // If the channel is full, backpressure the sender until the capacity is available
        if (this.decoree.length >= this.capacity) {
            const semaphore = new Signal()
            this.signals.push(semaphore)
            await semaphore.wait()
        }

        // Send data to the channel, but don't wait for it to be received
        this.decoree.send(data)

        // Yield execution to allow receivers to run
        await yieldExecution()
    }

    async receive(): Promise<T> {
        // Signal to the oldest blocked sender that there is now capacity available
        this.signals.shift()?.signal()
        return this.decoree.receive()
    }

    async *iter(): AsyncGenerator<T> {
        while (true) {
            yield await this.receive()
        }
    }
}
