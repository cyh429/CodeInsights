import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { monaco } from '@/utils/monaco';
const props = withDefaults(defineProps(), {
    language: 'c'
});
const editorContainer = ref(null);
const isInline = ref(false);
let diffEditor = null;
function languageFromFilename(filename) {
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    const map = {
        c: 'c', h: 'c', cpp: 'cpp', hpp: 'cpp',
        s: 'asm', S: 'asm',
        py: 'python', rs: 'rust', go: 'go',
        sh: 'shell', bash: 'shell',
        mk: 'makefile', Makefile: 'makefile',
        json: 'json', yaml: 'yaml', yml: 'yaml',
        md: 'markdown', txt: 'plaintext',
    };
    return map[ext] ?? props.language;
}
function createModels() {
    const lang = languageFromFilename(props.filename);
    return {
        original: monaco.editor.createModel(props.original, lang),
        modified: monaco.editor.createModel(props.modified, lang),
    };
}
function initEditor() {
    if (!editorContainer.value)
        return;
    diffEditor = monaco.editor.createDiffEditor(editorContainer.value, {
        readOnly: true,
        renderSideBySide: !isInline.value,
        automaticLayout: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 13,
        lineHeight: 20,
    });
    const models = createModels();
    diffEditor.setModel(models);
}
function toggleInline() {
    isInline.value = !isInline.value;
    diffEditor?.updateOptions({ renderSideBySide: !isInline.value });
}
onMounted(initEditor);
onBeforeUnmount(() => {
    const model = diffEditor?.getModel();
    model?.original?.dispose();
    model?.modified?.dispose();
    diffEditor?.dispose();
    diffEditor = null;
});
watch([() => props.original, () => props.modified], () => {
    if (!diffEditor)
        return;
    const oldModel = diffEditor.getModel();
    oldModel?.original?.dispose();
    oldModel?.modified?.dispose();
    const models = createModels();
    diffEditor.setModel(models);
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_withDefaultsArg = (function (t) { return t; })({
    language: 'c'
});
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "border border-gray-200 rounded-lg overflow-hidden" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-center justify-between px-3 py-1.5 bg-gray-50 border-b border-gray-200" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "text-xs font-mono text-gray-600 truncate" },
});
(__VLS_ctx.filename);
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.toggleInline) },
    ...{ class: "text-xs px-2 py-0.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors" },
});
(__VLS_ctx.isInline ? 'Side-by-side' : 'Inline');
__VLS_asFunctionalElement(__VLS_intrinsicElements.div)({
    ref: "editorContainer",
    ...{ class: "h-[400px]" },
});
/** @type {typeof __VLS_ctx.editorContainer} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-50']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['h-[400px]']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            editorContainer: editorContainer,
            isInline: isInline,
            toggleInline: toggleInline,
        };
    },
    __typeProps: {},
    props: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    __typeProps: {},
    props: {},
});
; /* PartiallyEnd: #4569/main.vue */
