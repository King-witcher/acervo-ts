import { yieldExecution } from '@/utils/utils'
import { type ISemaphoreSlot, Semaphore } from './semaphore'

/**
 * A channel for asynchronously sending and receiving data between asynchronous tasks.
 *
 * A channel can optionally be bounded by providing a Semaphore, which will cause new senders to
 * wait until space is available, or the channel can be closed, interrupting any for-await loops
 * consuming this channel and causing new pending receivers to throw a ChannelClosedException.
 */
export class Channel<T> {
    private closed = false
    private senders: Sender<T>[] = []
    private receivers: Receiver<T>[] = []
    private semaphore: Semaphore

    /**
     * @param semaphoreOrCapacity An optional Semaphore instance or capacity to control the maximum number of pending senders.
     *
     * If no argument is provided, the channel will be unbounded.
     */
    constructor(semaphoreOrCapacity?: Semaphore | number) {
        this.semaphore =
            semaphoreOrCapacity instanceof Semaphore
                ? semaphoreOrCapacity
                : new Semaphore(semaphoreOrCapacity ?? Infinity)
    }

    get length(): number {
        return this.senders.length
    }

    /**
     * Sends data to the channel. If there are waiting receivers, delivers the data immediately.
     *
     * If the channel is at maximum capacity, returns a promise that waits until space is available before resolving.
     *
     * Invoking this method yields execution to allow receivers to run, preventing starvation of waiting receivers.
     *
     * Throws a ChannelClosedException if the channel is closed.
     */
    async send(data: T): Promise<void> {
        // Acquire a slot from the semaphore before sending.
        const slot = await this.semaphore.acquire()

        if (this.closed) throw new ChannelClosedException()

        const receiver = this.receivers.shift()
        if (receiver) {
            // Immediately deliver data to the waiting receiver
            receiver.resolve(data)
            slot.release()
        } else {
            // Queue the data until a receiver is available
            this.senders.push({
                value: data,
                slot,
            })
        }

        // Yields execution so that the receiver can run.
        await yieldExecution()
    }

    /**
     * Receives data from the channel. If no data is available, waits until a sender provides data.
     *
     * Throws a ChannelClosedException if the channel is closed.
     */
    async receive(): Promise<T> {
        // Check for pending senders first to allow immediate delivery of data if available
        const sender = this.senders.shift()
        if (sender) {
            // If data is immediately available, return it synchronously
            // Release the semaphore slot after delivering the data to the receiver
            sender.slot.release()
            return sender.value
        }

        // Otherwise, check if the channel is closed before waiting for new data.
        if (this.closed) throw new ChannelClosedException()

        // If the channel is still open, enqueue as a receiver.
        return new Promise<T>((resolve, reject) => {
            this.receivers.push({ resolve, reject })
        })
    }

    /**
     * Returns an async generator that yields values from the channel until it is closed.
     */
    async *iter(): AsyncGenerator<T> {
        while (true) {
            try {
                yield await this.receive()
            } catch {
                break
            }
        }
    }

    /**
     * Same as iter()
     */
    async *[Symbol.asyncIterator](): AsyncGenerator<T> {
        yield* this.iter()
    }

    /**
     * Convenience method to collect all items from the channel into an array.
     */
    async collect(): Promise<T[]> {
        const result: T[] = []
        for await (const item of this) {
            result.push(item)
        }
        return result
    }

    /**
     * Closes the channel, signaling that no more data will be sent. All waiting receivers will be rejected with a ChannelClosedException, and subsequent calls to send or receive will also throw a ChannelClosedException.
     *
     * Any in-progress send() calls will complete before the channel is fully closed.
     */
    close() {
        // Use the semaphore to ensure that close() waits for any in-progress send() calls to complete.
        this.semaphore.withSlot(async () => {
            this.closed = true
            for (const receiver of this.receivers) {
                receiver.reject(new ChannelClosedException())
            }
            this.receivers = []
        })
    }
}

export class ChannelClosedException extends Error {
    constructor() {
        super('Channel is closed')
        this.name = 'ChannelClosedException'
    }
}

type Receiver<T> = {
    resolve: (value: T) => void
    reject: (e: unknown) => void
}

type Sender<T> = {
    value: T
    slot: ISemaphoreSlot
}
