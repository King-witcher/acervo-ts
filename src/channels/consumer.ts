import { Channel } from './channel'

type Writer = (data: any) => Promise<void>

export abstract class Pipe<T> {
    abstract write(data: T): Promise<void>
    abstract read(): Promise<T>
    abstract getWriter(): Promise<Writer>
}

export class WorkerPipe<TInput, TOutput> {
    private channel: Channel<TInput> = new Channel<TInput>()

    constructor(
        private readonly workFn: (input: TInput) => Promise<TOutput>,
        private readonly destination: Pipe<TOutput>,
        private readonly maxConcurrency: number,
    ) {

    }

    async write(input: TInput) {
        this.channel.send(input)
    }

    private async work() {
        for (;;) {
            const input = await this.channel.receive()
            const output = await this.workFn(input)
            await this.destination.write(output)
        }
    }
}
