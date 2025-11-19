/**
 * A Result type inspired by Rust that represents either success (Ok) or failure (Err)
 */
export type Result<T, E = Error> = Ok<T, E> | Err<T, E>

export namespace Result {
    export function fromPromise<T, E = unknown>(
        promise: Promise<T>,
    ): Promise<Result<T, E>> {
        return promise
            .then((value) => new Ok<T, E>(value))
            .catch((error) => new Err(error as E))
    }
}

export function ok<T, E>(value: T): Result<T, E> {
    return new Ok(value)
}

export function err<T, E>(error: E): Result<T, E> {
    return new Err(error)
}

class Ok<T, E> {
    readonly _tag = 'Ok'
    constructor(readonly value: T) {}

    /**
     * Returns true if the result is Ok.
     */
    isOk(): this is Ok<T, E> {
        return true
    }

    /**
     * Returns true if the result is Err.
     */
    isErr(): this is Err<T, E> {
        return false
    }

    /**
     * Returns the contained Ok value.
     *
     * Throws if the result is an Err.
     * @example
     * ```ts
     * const res: Result<number, string> = ok(2)
     * const value: number = res.unwrap() // value is 2
     *
     * const errRes: Result<number, string> = err("fail")
     * errRes.unwrap() // throws an error
     * ```
     */
    unwrap(): T {
        return this.value
    }

    /**
     * Returns the contained Ok value or a provided default if the result is an Err.
     * @example
     * ```ts
     * const res: Result<number, string> = ok(2)
     * const value: number = res.unwrapOr(0) // value is 2
     *
     * const errRes: Result<number, string> = err("fail")
     * const defaultValue: number = errRes.unwrapOr(0) // defaultValue is 0
     * ```
     */
    unwrapOr(_default: T): T {
        return this.value
    }

    /**
     * Returns the contained Err value.
     *
     * Throws if the result is an Ok.
     * @example
     * ```ts
     * const res: Result<number, string> = err("fail")
     * const error: string = res.unwrapErr() // error is "fail"
     * ```
     */
    unwrapErr(): never {
        throw new Error('Called unwrapErr on an Ok value')
    }

    /**
     * Returns a new Result with the Ok value mapped to a new value.
     * @example
     * ```ts
     * const res1: Result<number, Error> = ok(2)
     * const res2: Result<string, Error> = res1.map((x) => x.toString()) // res2 is Ok("2")
     * ```
     */
    map<U>(fn: (value: T) => U): Result<U, E> {
        return new Ok(fn(this.value))
    }

    /**
     * Returns a new Result with the Err value mapped to a new error.
     * @example
     * ```ts
     * const res1: Result<number, string> = ok(2)
     * const res2: Result<number, boolean> = res1.mapErr((e) => Boolean(e)) // res2 is still Ok(2)
     * ```
     */
    mapErr<F>(_fn: (err: E) => F): Result<T, F> {
        return new Ok(this.value)
    }

    /**
     * Calls op if the result is Ok, otherwise returns the Err value of self.
     * This function can be used for control flow based on Result values.
     * @example
     * ```ts
     * const res1: Result<number, string> = ok(2)
     * const res2 = res1.andThen((x) => ok(x * 3)) // res2 is Ok(6)
     *
     * const res3: Result<number, string> = err("error")
     * const res4 = res3.andThen((x) => ok(x * 3)) // res4 is Err("error")
     * ```
     */
    andThen<U>(op: (value: T) => Result<U, E>): Result<U, E> {
        return op(this.value)
    }

    /**
     * Pattern matches on the Result, calling the appropriate function based on whether it's Ok or Err.
     * @example
     * ```ts
     * const res: Result<number, string> = ok(2)
     * const message = res.match({
     *     ok: (value: number) => `Success with value ${value}`,
     *     err: (error: string) => `Failed with error ${error}`,
     * }) // message is "Success with value 2"
     * ```
     */
    match<U>(patterns: { ok: (value: T) => U; err: (error: E) => U }): U {
        return patterns.ok(this.value)
    }

    /**
     * Converts the Result into a Promise.
     * If the Result is Ok, the Promise resolves with the contained value.
     * If the Result is Err, the Promise rejects with the contained error.
     * @example
     * ```ts
     * const res: Result<number, string> = ok(2)
     * const value = await res.asPromise() // value is 2
     *
     * const errRes: Result<number, string> = err("fail")
     * const errValue = await errRes.asPromise() // rejects with "fail"
     * ```
     */
    asPromise(): Promise<T> {
        return Promise.resolve(this.value)
    }
}

class Err<T, E> {
    readonly _tag = 'Err'
    constructor(readonly error: E) {}

    /**
     * err value
     * @returns aa
     */
    isOk(): this is Ok<T, E> {
        return false
    }

    isErr(): this is Err<T, E> {
        return true
    }

    unwrap(): never {
        throw new Error(`Called unwrap on an Err value: ${this.error}`)
    }

    unwrapOr(defaultValue: T): T {
        return defaultValue
    }

    unwrapErr(): E {
        return this.error
    }

    map<U>(_fn: (value: T) => U): Result<U, E> {
        return this as unknown as Result<U, E>
    }

    mapErr<F>(fn: (err: E) => F): Result<T, F> {
        return new Err(fn(this.error))
    }

    andThen<U>(_fn: (value: T) => Result<U, E>): Result<U, E> {
        return new Err(this.error)
    }

    match<U>(patterns: { ok: (value: T) => U; err: (error: E) => U }): U {
        return patterns.err(this.error)
    }

    asPromise(): Promise<T> {
        return Promise.reject(this.error)
    }
}
