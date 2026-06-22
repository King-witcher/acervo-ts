export class Signal {
    private resolve: () => void
    private reject: (e: unknown) => void
    private promise: Promise<void>

    constructor() {
        const { promise, resolve, reject } = Promise.withResolvers<void>()
        this.promise = promise
        this.resolve = resolve
        this.reject = reject
    }

    signal() {
        this.resolve()
    }

    fail(e: unknown) {
        this.reject(e)
    }

    async wait() {
        return this.promise
    }
}
