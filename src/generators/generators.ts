export namespace Generators {
    export function* iter<T>(array: T[]): Generator<T> {
        for (const item of array) yield item
    }

    export function collect<T>(generator: Generator<T>): T[] {
        const results: T[] = []
        for (const value of generator) {
            results.push(value)
        }
        return results
    }

    export function map<T, U>(
        generator: Generator<T>,
        fn: (value: T) => U,
    ): Generator<U> {
        function* mapped() {
            for (const value of generator) {
                yield fn(value)
            }
        }
        return mapped()
    }

    export function filter<T>(
        generator: Generator<T>,
        predicate: (value: T) => boolean,
    ): Generator<T> {
        function* filtered() {
            for (const value of generator) {
                if (predicate(value)) {
                    yield value
                }
            }
        }
        return filtered()
    }

    export function first<T>(
        generator: Generator<T>,
        predicate: (value: T) => boolean = () => true,
    ): T | undefined {
        for (const item of generator) {
            if (predicate(item)) {
                return item
            }
        }
        return undefined
    }

    export function take<T>(generator: Generator<T>, count: number): T[] {
        const results: T[] = []
        for (const item of generator) {
            if (results.length < count) {
                results.push(item)
            } else {
                break
            }
        }
        return results
    }
}
