import DOMPurify from 'dompurify';
export const domPurifyConfig = {
    ADD_TAGS: ['html-viewer'],
    ADD_ATTR: [
        'src', 'alt',
        'data-mermaid-id', 'data-mermaid-code', 'id',
        'aria-hidden', 'aria-label', 'role',
        'viewbox', 'preserveaspectratio', 'd', 'fill', 'stroke', 'stroke-width',
        'stroke-linecap', 'stroke-linejoin', 'transform', 'x', 'y', 'width', 'height',
        'cx', 'cy', 'r', 'rx', 'ry', 'x1', 'x2', 'y1', 'y2', 'points', 'xmlns',
        'xmlns:xlink', 'xlink:href', 'style', 'class', 'tabindex', 'mathbackground',
        'mathcolor', 'displaystyle', 'scriptlevel',
    ],
    ALLOW_DATA_ATTR: true,
    ADD_URI_SAFE_ATTR: ['xlink:href'],
};
export const sanitizeHtml = (html) => {
    DOMPurify.setConfig(domPurifyConfig);
    return DOMPurify.sanitize(html);
};
