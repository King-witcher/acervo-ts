export class Signal {
    private resolve = () => {}
    private reject = (_: unknown) => {}
    private promise: Promise<void>

    constructor() {
        this.promise = new Promise<void>((resolve, reject) => {
            this.resolve = resolve
            this.reject = reject
        })
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
