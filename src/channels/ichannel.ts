/**
 * A simple FIFO channel for sending and receiving messages asynchronously.
 */
export interface IChannel<T> {
    /**
     * Returns the number of items currently in the channel's queue.
     */
    readonly length: number

    /**
     * Sends data to the channel.
     * If there are any receivers waiting, the data is immediately delivered to the first one.
     * Otherwise, the data is queued until a receiver is available.
     */
    send(data: T): Promise<void>

    /**
     * Receives data from the channel.
     * If there is data in the queue, it is immediately returned.
     * Otherwise, the receiver waits until data is sent to the channel.
     */
    receive(): Promise<T>

    /**
     * Returns an async generator that yields values as they are received.
     */
    iter(): AsyncGenerator<T>
}
