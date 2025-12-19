import { yieldExecution } from '@/utils/utils'
import { Channel } from './channel'
import { Semaphore } from './semaphore2'

export class BoundedChannel<T> extends Channel<T> {
    private semaphores: Semaphore[] = []

    constructor(private capacity: number) {
        super()
    }

    /**
     * Sends data to the channel.
     * If the channel is at maximum capacity, the sender waits until space is available.
     * Otherwise, returns immediately after sending the data.
     */
    override async send(data: T): Promise<void> {
        // If the channel is full, backpressure the sender until the capacity is available
        if (super.length >= this.capacity) {
            const semaphore = new Semaphore()
            this.semaphores.push(semaphore)
            await semaphore.wait()
        }

        // Send data to the channel, but don't wait for it to be received
        super.send(data)

        // Yield execution to allow receivers to run
        await yieldExecution()
    }

    /**
     * Receives data from the channel.
     * If there is data in the queue, it is immediately returned.
     * Otherwise, the receiver waits until data is sent to the channel.
     */
    override async receive(): Promise<T> {
        // Signal to the oldest blocked sender that there is now capacity available
        this.semaphores.shift()?.signal()
        return super.receive()
    }
}
