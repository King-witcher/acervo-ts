import { delay, yieldExecution } from '@/utils/utils'
import { Semaphore } from './semaphore2'

type Receiver<T> = (value: T) => void
type Sender<T> = {
    value: T
    semaphore: Semaphore
}

/**
 * A simple FIFO channel for sending and receiving messages asynchronously.
 */
export class Channel<T> {
    private senders: Sender<T>[] = []
    private receivers: Receiver<T>[] = []

    /**
     * Returns the number of items currently in the channel's queue.
     */
    get length(): number {
        return this.senders.length
    }

    /**
     * Sends data to the channel.
     * If there are any receivers waiting, the data is immediately delivered to the first one.
     * Otherwise, the data is queued until a receiver is available.
     */
    async send(data: T): Promise<void> {
        const receiver = this.receivers.shift()
        if (receiver) {
            // Immediately deliver data to the waiting receiver
            receiver(data)
        } else {
            // Queue the data until a receiver is available
            this.senders.push({
                value: data,
                semaphore: new Semaphore(),
            })
        }

        // Yields execution so that the receiver can run.
        await yieldExecution()
    }

    /**
     * Returns an async generator that yields values as they are received.
     */
    async *iter(): AsyncGenerator<T> {
        while (true) {
            yield await this.receive()
        }
    }

    /**
     * Receives data from the channel.
     * If there is data in the queue, it is immediately returned.
     * Otherwise, the receiver waits until data is sent to the channel.
     */
    async receive(): Promise<T> {
        const sender = this.senders.shift()
        if (sender) {
            // If data is immediately available, return it synchronously
            // Signal to the sender that the data has been received
            sender.semaphore.signal()
            return sender.value
        } else {
            // If no data is available, enqueue as a receiver and wait
            return new Promise<T>((resolve) => {
                this.receivers.push(resolve)
            })
        }
    }
}
