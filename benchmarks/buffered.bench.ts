import { Streams } from '@/streams/streams'
import { delay } from '@/utils/utils'

export async function* blocking() {
    for (let i = 0; i < 15; i++) {
        const delayMs = 30 + Math.random() * 10
        await delay(delayMs)
        yield true
    }
}

async function main() {
    const conc = Streams.buffered(blocking(), 5)
    await delay(2000)
    let last = Date.now()
    for await (const _ of conc) {
        console.log('elapsed', Date.now() - last)
        last = Date.now()
    }
}

main()
