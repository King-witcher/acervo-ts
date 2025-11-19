type Resolver<T> = (value: T) => void

/**
 * A simple FIFO channel for sending and receiving messages asynchronously.
 */
export class Channel<T> {
    private queue: { data: T }[] = []
    private waitingResolvers: Resolver<T>[] = []

    /**
     * Returns the number of items currently in the channel's queue.
     */
    get length(): number {
        return this.queue.length
    }

    /**
     * Sends data to the channel.
     * If there are any receivers waiting, the data is immediately delivered to the first one.
     * Otherwise, the data is queued until a receiver is available.
     * @param data The data to send.
     */
    send(data: T): void {
        const resolver = this.waitingResolvers.shift()
        if (resolver) resolver(data)
        else this.queue.push({ data })
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
        return new Promise<T>((resolve) => {
            const el = this.queue.shift()
            if (el) resolve(el.data)
            else this.waitingResolvers.push(resolve)
        })
    }
}
