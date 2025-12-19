import { yieldExecution } from '@/utils/utils'
import { Semaphore } from './semaphore2'

type Receiver<T> = (value: T) => void
type QueueEntry<T> = {
    value: T
}

export class BoundedChannel<T> {
    private queue: QueueEntry<T>[] = []
    private receivers: Receiver<T>[] = []
    private semaphores: Semaphore[] = []

    constructor(private capacity: number) {}

    /**
     * Sends data to the channel.
     * If the channel is at maximum capacity, the sender waits until space is available.
     * Otherwise, returns immediately after sending the data.
     */
    async send(data: T): Promise<void> {
        if (this.queue.length >= this.capacity) {
            const semaphore = new Semaphore()
            this.semaphores.push(semaphore)
            await semaphore.wait()
        }

        const receiver = this.receivers.shift()
        receiver?.(data)
        if (!receiver) {
            this.queue.push({ value: data })
        }

        // Yield execution to allow receivers to run
        await yieldExecution()
    }

    /**
     * Receives data from the channel.
     * If there is data in the queue, it is immediately returned.
     * Otherwise, the receiver waits until data is sent to the channel.
     */
    async receive(): Promise<T> {
        const entry = this.queue.shift()
        if (entry) {
            const semaphore = this.semaphores.shift()
            semaphore?.signal()
            return entry.value
        } else {
            return new Promise<T>((resolve) => {
                this.receivers.push(resolve)
            })
        }
    }

    /**
     * Returns an async generator that yields values as they are received.
     */
    async *iter(): AsyncGenerator<T> {
        while (true) {
            yield await this.receive()
        }
    }
}
