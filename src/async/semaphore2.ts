export class Semaphore {
    private resolve: () => void
    private promise: Promise<void>

    constructor() {
        const { promise, resolve } = Promise.withResolvers<void>()
        this.promise = promise
        this.resolve = resolve
    }

    signal() {
        this.resolve()
    }

    async wait() {
        return this.promise
    }
}
