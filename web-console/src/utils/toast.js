export function showToast(options) {
    const config = typeof options === 'string' ? { message: options } : options;
    const detail = {
        message: config.message,
        type: config.type || 'info',
        duration: config.duration === undefined ? 3000 : config.duration,
    };
    window.dispatchEvent(new CustomEvent('toast', { detail }));
}
export function showErrorToast(message, duration) {
    showToast({ message, type: 'error', duration });
}
export function showInfoToast(message, duration) {
    showToast({ message, type: 'info', duration });
}
export function showSuccessToast(message, duration) {
    showToast({ message, type: 'success', duration });
}
