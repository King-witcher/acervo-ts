export async function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function defer(deferred: () => void) {
    return Promise.resolve().then(deferred)
}
