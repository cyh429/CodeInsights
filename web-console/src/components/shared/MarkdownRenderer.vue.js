import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { renderMarkdown, renderMermaidInContainer } from '@/utils/markdown';
const props = defineProps();
const containerRef = ref(null);
const html = computed(() => renderMarkdown(props.content));
async function processMermaid() {
    await nextTick();
    if (containerRef.value) {
        await renderMermaidInContainer(containerRef.value);
    }
}
onMounted(processMermaid);
watch(() => props.content, () => {
    if (!props.streaming) {
        processMermaid();
    }
});
watch(() => props.streaming, (val) => {
    if (!val)
        processMermaid();
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div)({
    ref: "containerRef",
    ...{ class: "markdown-body prose prose-sm max-w-none dark:prose-invert" },
});
__VLS_asFunctionalDirective(__VLS_directives.vHtml)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.html) }, null, null);
/** @type {typeof __VLS_ctx.containerRef} */ ;
/** @type {__VLS_StyleScopedClasses['markdown-body']} */ ;
/** @type {__VLS_StyleScopedClasses['prose']} */ ;
/** @type {__VLS_StyleScopedClasses['prose-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-none']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:prose-invert']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            containerRef: containerRef,
            html: html,
        };
    },
    __typeProps: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    __typeProps: {},
});
; /* PartiallyEnd: #4569/main.vue */
