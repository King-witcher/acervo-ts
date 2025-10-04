type Resolver<T> = (value: T) => void

export class Channel<T> {
    private queue: { data: T }[] = []
    private waitingResolvers: Resolver<T>[] = []

    get length(): number {
        return this.queue.length
    }

    send(data: T): void {
        const resolver = this.waitingResolvers.shift()
        if (resolver) resolver(data)
        else this.queue.push({ data })
    }

    async *iter(): AsyncGenerator<T> {
        while (true) {
            yield await this.receive()
        }
    }

    async receive(): Promise<T> {
        return new Promise<T>((resolve) => {
            const el = this.queue.shift()
            if (el) resolve(el.data)
            else this.waitingResolvers.push(resolve)
        })
    }
}
