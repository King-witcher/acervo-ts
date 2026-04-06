import { Signal } from './signal'

/**
 * A counting FIFO semaphore implementation for managing concurrent access to a limited number of resources.
 */
export class Semaphore {
    private waiters: Signal[] = []
    private _slots: number

    private set slots(value: number) {
        this._slots = value
    }

    /**
     * The current number of available slots in the semaphore.
     */
    public get slots() {
        return this._slots
    }

    constructor(public readonly capacity: number) {
        this._slots = capacity
    }

    /**
     * Acquires a slot from the semaphore. If no slots are available, waits until one is released.
     */
    public async acquire(): Promise<ISemaphoreSlot> {
        // If there is no capacity, wait until one is available and acquire it directly without decrementing the capacity
        if (!this.slots) {
            const signal = new Signal()
            this.waiters.push(signal)
            await signal.wait()
            return new SemaphoreSlot(this.release.bind(this))
        }

        // Otherwise, acquire capacity from the pool and return a concession
        this.slots--
        return new SemaphoreSlot(this.release.bind(this))
    }

    /**
     * Create a child semaphore with a specified capacity.
     *
     * If capacity is greater than the parent's capacity, it will be reduced to match the parent's capacity.
     */
    public createChildSemaphore(capacity: number): Semaphore {
        return new ChildSemaphore(this, Math.min(capacity, this.slots))
    }

    /**
     * Convenience method to acquire a slot, execute a function, and automatically release the slot afterward, even if the function throws an error.
     */
    public async withSlot<T>(fn: () => Promise<T>): Promise<T> {
        const slot = await this.acquire()
        try {
            return await fn()
        } finally {
            slot.release()
        }
    }

    private release() {
        const waiter = this.waiters.shift()
        if (waiter) {
            // If there are waiters, transfers slot directly
            waiter.signal()
        } else {
            // Otherwise, give back to the pool
            this.slots++
        }
    }
}

export interface ISemaphoreSlot {
    /**
     * Releases the slot back to the semaphore.
     *
     * This method can only be called once per slot; subsequent calls will throw an error.
     */
    release(): void
}

class SemaphoreSlot implements ISemaphoreSlot {
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

class ChildSemaphore extends Semaphore {
    constructor(
        private parent: Semaphore,
        capacity: number,
    ) {
        super(capacity)
    }

    override async acquire(): Promise<SemaphoreSlot> {
        const childSlot = await super.acquire()
        const parentSlot = await this.parent.acquire()
        return new SemaphoreSlot(() => {
            childSlot.release()
            parentSlot.release()
        })
    }
}
