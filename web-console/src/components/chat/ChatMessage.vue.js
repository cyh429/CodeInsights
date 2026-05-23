import { computed } from 'vue';
import { User, Bot, Copy, Check } from 'lucide-vue-next';
import { ref } from 'vue';
import MarkdownRenderer from '@/components/shared/MarkdownRenderer.vue';
import { copyToClipboard } from '@/utils/dom';
const props = defineProps();
const copied = ref(false);
const isUser = computed(() => props.role === 'user');
async function handleCopy() {
    const ok = await copyToClipboard(props.content);
    if (ok) {
        copied.value = true;
        setTimeout(() => { copied.value = false; }, 2000);
    }
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex gap-3 py-4" },
    ...{ class: (__VLS_ctx.isUser ? 'flex-row-reverse' : '') },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex size-8 shrink-0 items-center justify-center rounded-full" },
    ...{ class: (__VLS_ctx.isUser ? 'bg-blue-100 dark:bg-blue-900' : 'bg-gray-100 dark:bg-gray-800') },
});
if (__VLS_ctx.isUser) {
    const __VLS_0 = {}.User;
    /** @type {[typeof __VLS_components.User, ]} */ ;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
        ...{ class: "size-4 text-blue-600 dark:text-blue-400" },
    }));
    const __VLS_2 = __VLS_1({
        ...{ class: "size-4 text-blue-600 dark:text-blue-400" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
}
else {
    const __VLS_4 = {}.Bot;
    /** @type {[typeof __VLS_components.Bot, ]} */ ;
    // @ts-ignore
    const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
        ...{ class: "size-4 text-gray-600 dark:text-gray-400" },
    }));
    const __VLS_6 = __VLS_5({
        ...{ class: "size-4 text-gray-600 dark:text-gray-400" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_5));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "min-w-0 max-w-[80%]" },
});
if (__VLS_ctx.isUser) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "rounded-2xl rounded-tr-sm bg-blue-600 px-4 py-2.5 text-sm text-white" },
    });
    (__VLS_ctx.content);
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "group relative" },
    });
    /** @type {[typeof MarkdownRenderer, ]} */ ;
    // @ts-ignore
    const __VLS_8 = __VLS_asFunctionalComponent(MarkdownRenderer, new MarkdownRenderer({
        content: (__VLS_ctx.content),
        streaming: (__VLS_ctx.streaming),
    }));
    const __VLS_9 = __VLS_8({
        content: (__VLS_ctx.content),
        streaming: (__VLS_ctx.streaming),
    }, ...__VLS_functionalComponentArgsRest(__VLS_8));
    if (__VLS_ctx.content && !__VLS_ctx.streaming) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (__VLS_ctx.handleCopy) },
            ...{ class: "absolute -bottom-6 right-0 flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-gray-400 opacity-0 transition-opacity hover:text-gray-600 group-hover:opacity-100" },
        });
        if (__VLS_ctx.copied) {
            const __VLS_11 = {}.Check;
            /** @type {[typeof __VLS_components.Check, ]} */ ;
            // @ts-ignore
            const __VLS_12 = __VLS_asFunctionalComponent(__VLS_11, new __VLS_11({
                ...{ class: "size-3" },
            }));
            const __VLS_13 = __VLS_12({
                ...{ class: "size-3" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_12));
        }
        else {
            const __VLS_15 = {}.Copy;
            /** @type {[typeof __VLS_components.Copy, ]} */ ;
            // @ts-ignore
            const __VLS_16 = __VLS_asFunctionalComponent(__VLS_15, new __VLS_15({
                ...{ class: "size-3" },
            }));
            const __VLS_17 = __VLS_16({
                ...{ class: "size-3" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_16));
        }
        (__VLS_ctx.copied ? '已复制' : '复制');
    }
}
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['size-8']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['size-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-blue-600']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-blue-400']} */ ;
/** @type {__VLS_StyleScopedClasses['size-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-[80%]']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-tr-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-blue-600']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['group']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['-bottom-6']} */ ;
/** @type {__VLS_StyleScopedClasses['right-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['px-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-0']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-opacity']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['group-hover:opacity-100']} */ ;
/** @type {__VLS_StyleScopedClasses['size-3']} */ ;
/** @type {__VLS_StyleScopedClasses['size-3']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            User: User,
            Bot: Bot,
            Copy: Copy,
            Check: Check,
            MarkdownRenderer: MarkdownRenderer,
            copied: copied,
            isUser: isUser,
            handleCopy: handleCopy,
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
