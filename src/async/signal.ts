export class Signal extends Promise<void> {
    private _resolve: () => void
    constructor() {
        let _resolve = () => {}
        super((resolve) => {
            _resolve = () => resolve()
        })
        this._resolve = _resolve
    }

    fulfill() {
        this._resolve()
    }
}
