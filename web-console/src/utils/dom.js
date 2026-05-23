export async function copyToClipboard(text) {
    if (navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        }
        catch {
            // fall through to fallback
        }
    }
    try {
        const activeElement = document.activeElement;
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
        textArea.setAttribute('readonly', '');
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(textArea);
        activeElement?.focus?.();
        return ok;
    }
    catch {
        return false;
    }
}
export function getParentElement(selector, parentSelector) {
    const element = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!element)
        return null;
    if (parentSelector)
        return element.closest(parentSelector) ?? null;
    return element.parentElement;
}
