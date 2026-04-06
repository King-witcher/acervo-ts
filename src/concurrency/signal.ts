export class Signal {
    private resolve = () => {}
    private promise: Promise<void>

    constructor() {
        this.promise = new Promise<void>((resolve) => {
            this.resolve = resolve
        })
    }

    signal() {
        this.resolve()
    }

    async wait() {
        return this.promise
    }
}
