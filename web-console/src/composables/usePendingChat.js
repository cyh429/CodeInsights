let _pending = null;
export function setPendingChat(data) {
    _pending = data;
}
export function consumePendingChat() {
    const data = _pending;
    _pending = null;
    return data;
}
