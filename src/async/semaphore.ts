import { Signal } from './signal'

export class Semaphore {
    private waiters: Signal[] = []

    constructor(private capacity: number) {}

    async acquire(): Promise<Concession> {
        if (!this.capacity) {
            const signal = new Signal()
            this.waiters.push(signal)
            await signal.wait()
        }

        this.capacity--
        return new Concession(this.release.bind(this))
    }

    private release() {
        this.capacity++
        this.waiters.shift()?.signal()
    }
}

class Concession {
    released: boolean = false
    constructor(private _release: () => void) {}

    release() {
        if (this.released) throw new Error('Permission already released')
        this.released = true
        this._release()
    }

    [Symbol.dispose]() {
        this.release()
    }
}
