import type { Channel } from '@/channels/channel'

/**
 * A worker that processes input data concurrently and sends the results to an output channel.
 */
export class Worker<TInput, TOutput> {
    constructor(
        private output: Channel<TOutput> | Array<TOutput>,
        private concurrency: number,
        private workerFn: (input: TInput) => Promise<TOutput>,
    ) {}

    /**
     * Consumes data from the source, processes it using the worker function,
     * and sends the results to the output channel or array.
     */
    async consume(
        source: Array<TInput> | Generator<TInput> | AsyncGenerator<TInput>,
    ): Promise<void> {
        const { resolve, reject, promise } = Promise.withResolvers<void>()
        let stop = false

        const workers = Array.from({ length: this.concurrency }).map(async () => {
            // If source is an array, convert it to an iterator to avoid repeated processing
            const source_ = Array.isArray(source) ? source.values() : source
            for await (const item of source_) {
                if (stop) break

                const result = await this.workerFn(item)

                if (Array.isArray(this.output)) this.output.push(result)
                else {
                    try {
                        await this.output.send(result)
                    } catch (e) {
                        stop = true
                        throw e
                    }
                }
            }
        })

        Promise.all(workers)
            .then(() => resolve())
            .catch(reject)

        return promise
    }
}
