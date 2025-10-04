import { Channel } from '@/async/channel'

export namespace Streams {
    export async function* iter<T>(array: T[]): AsyncGenerator<T> {
        for (const item of array) yield item
    }

    export async function* intoAsync<T>(
        generator: Generator<T>,
    ): AsyncGenerator<T> {
        for (const item of generator) yield item
    }

    export async function* mapConcurrent<Input, Output>(
        inputGenerator: AsyncGenerator<Input>,
        mapFn: (input: Input) => Promise<Output>,
        maxConcurrency = 12,
    ): AsyncGenerator<Output> {
        const channel = new Channel<{ data: Output } | null>()

        const resolvers = Array(maxConcurrency)
            .fill(1)
            .map(async () => {
                for await (const input of inputGenerator) {
                    const output = await mapFn(input)
                    channel.send({ data: output })
                }
            })

        Promise.all(resolvers).then(() => {
            channel.send(null)
        })

        for await (const output of channel.iter()) {
            if (output === null) break
            yield output.data
        }
    }

    /**
     * Buffers the output of an async generator and yields the results as they come.
     * @param generator The async generator to buffer
     * @param bufferSize The maximum number of items to buffer
     */
    export async function* buffered<T>(
        generator: AsyncGenerator<T>,
        bufferSize: number,
    ) {
        // A concession is a token that allows a worker to process a new item.
        // The bufferSize limits how many items can be stored in memory at once.
        // If a concession is true, the worker is free to process a new item.
        // If a concession is false, the worker should shut down and stop awaiting for new items.
        const concessions = new Channel<boolean>()
        const results = new Channel<{ data: T } | null>()

        // Fills the concessions queue with bufferSize tokens
        Array(bufferSize)
            .fill(1)
            .forEach(() => {
                concessions.send(true)
            })

        // Start a worker that will process the generator as concessions come in
        ;(async () => {
            while (await concessions.receive()) {
                const { value, done } = await generator.next()
                if (done) {
                    results.send(null)
                    break
                }
                results.send({ data: value })
            }
        })()

        // Yields results as they come and make new concessions
        for await (const item of results.iter()) {
            if (item === null) {
                concessions.send(false)
                break
            }
            yield item.data
            concessions.send(true)
        }
    }

    /**
     * Buffers the output of an async generator and yields the results as they get ready.
     *
     * The results may come out of order, depending on how fast each worker processes each item.
     * @param generator The async generator to buffer
     * @param bufferSize The maximum number of items to buffer
     * @param concurrency The maximum number of concurrent workers
     */
    export async function* bufferedConcurrent<T>(
        generator: AsyncGenerator<T>,
        bufferSize: number,
        concurrency: number,
    ) {
        // A concession is a token that allows a worker to process a new item.
        // The bufferSize limits how many items can be stored in memory at once,
        // while the concurrency limits how many workers can run at the same time.
        // If a concession is true, the worker is free to process a new item.
        // If a concession is false, the worker should shut down and stop awaiting for new items.
        const concessions = new Channel<boolean>()
        const results = new Channel<{ data: T } | null>()
        let finished = false

        // Fills the concessions queue with bufferSize tokens
        Array(bufferSize)
            .fill(1)
            .forEach(() => {
                concessions.send(true)
            })

        // Start the workers
        Array(concurrency)
            .fill(1)
            .forEach(async () => {
                while (await concessions.receive()) {
                    // If has received a concession, but the generator is finished, kill the worker
                    if (finished) break
                    const { value, done } = await generator.next()
                    if (done) {
                        finished = true
                        results.send(null)
                        break
                    }
                    results.send({ data: value })
                }
            })

        // Yields results as they come and make new concessions
        for await (const item of results.iter()) {
            if (item === null) {
                // When the generator is finished, send false concessions to kill all pending workers
                for (let i = 0; i < concurrency; i++) concessions.send(false)
                break
            }
            yield item.data
            concessions.send(true)
        }
    }

    export async function* concurrent<T>(
        generator: AsyncGenerator<T>,
        concurrency: number,
    ) {
        const channel = new Channel<{ data: T } | null>()
        const resolvers = Array(concurrency)
            .fill(1)
            .map(async () => {
                for await (const item of generator) {
                    channel.send({ data: item })
                }
            })

        Promise.all(resolvers).then(() => {
            channel.send(null)
        })

        for await (const output of channel.iter()) {
            if (output === null) break
            yield output.data
        }
    }

    export async function collectSeq<T>(
        stream: AsyncGenerator<T>,
    ): Promise<T[]> {
        const results: T[] = []
        for await (const item of stream) {
            results.push(item)
        }
        return results
    }
}
