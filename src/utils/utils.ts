export async function delayMs(ms = 0): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function defer(deferred: () => void) {
    await delayMs()
    deferred()
}

export async function yieldExecution() {
    await delayMs()
}
