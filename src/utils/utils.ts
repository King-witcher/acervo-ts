export async function delay(ms = 0): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function defer(deferred: () => void) {
    await delay()
    deferred()
}

export async function yieldExecution() {
    await delay()
}
