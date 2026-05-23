export function formatMarkdown(text) {
    if (!text || typeof text !== 'string')
        return '';
    return preprocessMarkdown(text);
}
function preprocessMarkdown(text) {
    let result = text;
    result = result.replace(/^```(?:markdown|md)?\s*\n?/i, '');
    result = result.replace(/\n?```\s*$/i, '');
    result = result.replace(/\n{3,}/g, '\n\n');
    result = result.replace(/^(\s*)[*+]\s/gm, '$1- ');
    result = result.replace(/^(\s*)-\s{2,}/gm, '$1- ');
    result = result.replace(/^(\s*)(\d+)\.\s{2,}/gm, '$1$2. ');
    result = result.replace(/([^\n])\n(#{1,6}\s)/g, '$1\n\n$2');
    result = result.replace(/(^#{1,6}\s[^\n]+)\n([^\n#])/gm, '$1\n\n$2');
    result = result.replace(/```(\w+)(\s*)\n/g, (_, lang) => '```' + lang.toLowerCase() + '\n');
    result = result.replace(/`\s+([^`]+?)\s+`/g, '`$1`');
    result = result.replace(/\[([^\]]+)\]\s*\(\s*([^)\s]+)\s*\)/g, '[$1]($2)');
    const codeBlockCount = (result.match(/```/g) || []).length;
    if (codeBlockCount % 2 !== 0) {
        result += '\n```';
    }
    result = result.replace(/\s+([.,!?;:])/g, '$1');
    result = normalizeTables(result);
    result = result.replace(/^>(\s*)(\S)/gm, '> $2');
    return result.trim();
}
function normalizeTables(text) {
    const lines = text.split('\n');
    const result = [];
    let inTable = false;
    for (const line of lines) {
        const isTableRow = /^\|.*\|$/.test(line.trim());
        const isTableDivider = /^\|[-:\s|]+\|$/.test(line.trim());
        if (isTableRow || isTableDivider) {
            if (!inTable && result.length > 0 && result[result.length - 1].trim() !== '') {
                result.push('');
            }
            inTable = true;
            result.push(line);
        }
        else {
            if (inTable && line.trim() !== '') {
                result.push('');
            }
            inTable = false;
            result.push(line);
        }
    }
    return result.join('\n');
}
export function extractXmlTags(text) {
    const tags = {};
    let cleanedText = text;
    const match = cleanedText.match(/<suggested_questions>([\s\S]*?)<\/suggested_questions>/);
    if (match) {
        tags.suggested_questions = match[1];
        cleanedText = cleanedText.replace(/<suggested_questions>[\s\S]*?<\/suggested_questions>/, '');
    }
    return { cleanedText, tags };
}
