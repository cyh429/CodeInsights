import hljs from 'highlight.js';
import katex from 'katex';
import { Marked } from 'marked';
import { sanitizeHtml } from '@/utils/content';
import { formatMarkdown } from '@/utils/markdownFormatter';
let mermaidInstance = null;
let mermaidReady = false;
const mermaidCache = new Map();
async function initMermaid() {
    if (mermaidReady)
        return;
    const m = await import('mermaid');
    mermaidInstance = m.default;
    mermaidInstance.initialize({
        startOnLoad: false,
        theme: 'default',
        securityLevel: 'loose',
    });
    mermaidReady = true;
}
function renderKaTeX(formula, displayMode) {
    try {
        return katex.renderToString(formula, { throwOnError: false, displayMode });
    }
    catch {
        return `<code>${formula}</code>`;
    }
}
function preprocessMath(text) {
    const blocks = new Map();
    let counter = 0;
    let result = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, formula) => {
        const id = `MATH_BLOCK_${counter++}`;
        blocks.set(id, renderKaTeX(formula.trim(), true));
        return id;
    });
    result = result.replace(/(?<!\$)\$(?!\$)(.+?)(?<!\$)\$(?!\$)/g, (match, formula) => {
        if (/^\d+([.,]\d+)?$/.test(formula.trim()))
            return match;
        const id = `MATH_INLINE_${counter++}`;
        blocks.set(id, renderKaTeX(formula.trim(), false));
        return id;
    });
    return { text: result, blocks };
}
function postprocessMath(html, blocks) {
    let result = html;
    for (const [id, rendered] of blocks) {
        result = result.replace(id, rendered);
    }
    return result;
}
function createRenderer() {
    const marked = new Marked();
    let mermaidCounter = 0;
    const renderer = {
        code(token) {
            const code = token.text;
            const lang = token.lang || '';
            if (lang === 'mermaid') {
                const id = `mermaid-${Date.now()}-${mermaidCounter++}`;
                const encoded = encodeURIComponent(code);
                return `<div class="mermaid-wrapper" data-mermaid-id="${id}" data-mermaid-code="${encoded}"><pre><code>${code}</code></pre></div>`;
            }
            let highlighted;
            if (lang && hljs.getLanguage(lang)) {
                highlighted = hljs.highlight(code, { language: lang }).value;
            }
            else {
                highlighted = hljs.highlightAuto(code).value;
            }
            const lines = code.split('\n');
            const lineNums = lines.map((_, i) => `<span>${i + 1}</span>`).join('\n');
            const encoded = encodeURIComponent(code);
            return `<div class="code-block-wrapper">
        <div class="code-block-header">
          <span class="code-lang">${lang || 'text'}</span>
          <button class="copy-btn" onclick="navigator.clipboard.writeText(decodeURIComponent('${encoded}')).then(()=>{this.textContent='已复制!';setTimeout(()=>this.textContent='复制',2000)})">复制</button>
        </div>
        <div class="code-block-body${lines.length > 20 ? ' collapsed' : ''}">
          <pre class="line-numbers"><code>${lineNums}</code></pre>
          <pre class="code-content"><code class="hljs language-${lang}">${highlighted}</code></pre>
        </div>
        ${lines.length > 20 ? `<button class="expand-btn" onclick="this.previousElementSibling.classList.toggle('collapsed');this.textContent=this.previousElementSibling.classList.contains('collapsed')?'展开 (${lines.length} 行)':'收起'"}>展开 (${lines.length} 行)</button>` : ''}
      </div>`;
        },
        link(token) {
            const href = token.href || '';
            const title = token.title ? ` title="${token.title}"` : '';
            const text = token.text || href;
            if (href.startsWith('http')) {
                return `<a href="${href}"${title} target="_blank" rel="noopener noreferrer">${text}</a>`;
            }
            return `<a href="${href}"${title}>${text}</a>`;
        },
    };
    marked.use({ renderer, breaks: true, gfm: true });
    return marked;
}
const markedInstance = createRenderer();
export function renderMarkdown(text) {
    if (!text)
        return '';
    const formatted = formatMarkdown(text);
    const { text: mathProcessed, blocks } = preprocessMath(formatted);
    const html = markedInstance.parse(mathProcessed);
    const restored = postprocessMath(html, blocks);
    return sanitizeHtml(restored);
}
export async function renderMermaidInContainer(container) {
    await initMermaid();
    const wrappers = Array.from(container.querySelectorAll('.mermaid-wrapper[data-mermaid-code]'));
    for (const wrapper of wrappers) {
        const encoded = wrapper.getAttribute('data-mermaid-code');
        const id = wrapper.getAttribute('data-mermaid-id') || `mermaid-${Date.now()}`;
        if (!encoded)
            continue;
        const code = decodeURIComponent(encoded);
        if (mermaidCache.has(code)) {
            wrapper.innerHTML = mermaidCache.get(code);
            continue;
        }
        try {
            const { svg } = await mermaidInstance.render(id, code);
            mermaidCache.set(code, svg);
            wrapper.innerHTML = svg;
        }
        catch {
            wrapper.innerHTML = `<pre class="mermaid-error"><code>${code}</code></pre>`;
        }
    }
}
