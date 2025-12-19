export abstract class Pipe<T, U = T> {
    abstract write(data: T): Promise<void>
    abstract read(): Promise<U>
    abstract readFrom()
}
