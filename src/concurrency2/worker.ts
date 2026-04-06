import { yieldExecution } from '@/utils/utils'
import { Channel } from './channel'
import { Semaphore } from './semaphore'

type WorkerProps<TInput, TOutput> = {
    output?: Channel<TOutput>
    workerFn: (input: TInput) => Promise<TOutput[]>
} & (
    | {
          semaphore: Semaphore
      }
    | {
          concurrency: number
      }
)

export class Worker<TInput, TOutput> {
    readonly output: Channel<TOutput>
    private semaphore: Semaphore
    private worker: (input: TInput) => Promise<TOutput[]>

    constructor(props: WorkerProps<TInput, TOutput>) {
        this.output = props.output ?? new Channel<TOutput>()
        this.semaphore = 'semaphore' in props ? props.semaphore : new Semaphore(props.concurrency)
        this.worker = props.workerFn
    }

    /**
     * Digests items from the source, processes them with the worker function, and sends results to the output channel.
     *
     * Returns a promise that resolves when all items from the source have been processed and all worker tasks have completed.
     *
     * If the worker function fails, the error will be thrown and the worker will stop processing further items. Error handling and retry logic must be implemented by the worker function.
     */
    async digest(source: Array<TInput> | Generator<TInput> | AsyncGenerator<TInput>) {
        // Create a single iterator from the source
        const iterator = Array.isArray(source) ? source.values() : source
        let abort = false

        const workerMain: () => Promise<void> = async () => {
            for await (const item of iterator) {
                if (abort) break

                const slot = await this.semaphore.acquire()
                try {
                    const results = await this.worker(item)
                    for (const result of results) {
                        await this.output.send(result)
                    }
                } catch (err) {
                    abort = true
                    throw err
                } finally {
                    // Release the slot back to the semaphore after processing each item
                    slot.release()

                    // Yields the thread to the event loop to allow other workers to acquire the semaphore if they are waiting, preventing starvation
                    await yieldExecution()
                }
            }
        }

        // Create a number of workers equal to the semaphore's capacity
        const workers = Array.from({ length: this.semaphore.capacity }).map(workerMain)

        // Wait for all workers to finish processing before returning
        await Promise.all(workers)
    }
}
