import { yieldExecution } from '@/utils/utils'
import { Signal } from '../async/signal2'
import type { IChannel } from './ichannel'

type Receiver<T> = (value: T) => void
type Sender<T> = {
    value: T
    signal: Signal
}

export class Channel<T> implements IChannel<T> {
    private senders: Sender<T>[] = []
    private receivers: Receiver<T>[] = []

    get length(): number {
        return this.senders.length
    }

    async send(data: T): Promise<void> {
        const receiver = this.receivers.shift()
        if (receiver) {
            // Immediately deliver data to the waiting receiver
            receiver(data)
        } else {
            // Queue the data until a receiver is available
            this.senders.push({
                value: data,
                signal: new Signal(),
            })
        }

        // Yields execution so that the receiver can run.
        await yieldExecution()
    }

    async *iter(): AsyncGenerator<T> {
        while (true) {
            yield await this.receive()
        }
    }

    async receive(): Promise<T> {
        const sender = this.senders.shift()
        if (sender) {
            // If data is immediately available, return it synchronously
            // Signal to the sender that the data has been received
            sender.signal.signal()
            return sender.value
        } else {
            // If no data is available, enqueue as a receiver and wait
            return new Promise<T>((resolve) => {
                this.receivers.push(resolve)
            })
        }
    }
}
