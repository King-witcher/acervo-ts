import { Channel } from './channel'

type FiniteChannelData<T> = null | { value: T }

export class FiniteChannelClosedError extends Error {
    constructor() {
        super('Finite channel is closed')
    }
}

export class FiniteChannel<T> extends Channel<T> {
    private innerChannel: Channel<FiniteChannelData<T>> = new Channel()
    private isClosed: boolean = false

    override get length(): number {
        return this.innerChannel.length
    }

    override async send(data: T): Promise<void> {
        if (this.isClosed) {
            throw new FiniteChannelClosedError()
        }
        await this.innerChannel.send({ value: data })
    }

    override async receive(): Promise<T> {
        const result = await this.innerChannel.receive()
        if (result === null) {
            throw new FiniteChannelClosedError()
        }
        return result.value
    }

    /**
     * Closes the channel, signaling that no more data will be sent.
     */
    close() {
        if (!this.isClosed) {
            this.isClosed = true
            this.innerChannel.send(null)
        }
    }

    override async *iter(): AsyncGenerator<T> {
        while (true) {
            const result = await this.innerChannel.receive()
            if (result === null) {
                break
            }
            yield result.value
        }
    }
}
