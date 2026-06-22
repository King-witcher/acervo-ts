async function delayMs(ms = 0): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function yieldExecution() {
    await delayMs()
}
