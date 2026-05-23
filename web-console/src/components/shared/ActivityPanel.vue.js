import { computed } from 'vue';
import { Loader2, CheckCircle2, XCircle, Wrench } from 'lucide-vue-next';
const props = defineProps();
const emit = defineEmits();
const hasItems = computed(() => props.items.length > 0);
const runningCount = computed(() => props.items.filter((i) => i.status === 'running').length);
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
if (__VLS_ctx.hasItems) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.hasItems))
                    return;
                __VLS_ctx.emit('toggle');
            } },
        ...{ class: "flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800" },
    });
    if (__VLS_ctx.runningCount > 0) {
        const __VLS_0 = {}.Loader2;
        /** @type {[typeof __VLS_components.Loader2, ]} */ ;
        // @ts-ignore
        const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
            ...{ class: "size-3.5 animate-spin" },
        }));
        const __VLS_2 = __VLS_1({
            ...{ class: "size-3.5 animate-spin" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    }
    else {
        const __VLS_4 = {}.Wrench;
        /** @type {[typeof __VLS_components.Wrench, ]} */ ;
        // @ts-ignore
        const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
            ...{ class: "size-3.5" },
        }));
        const __VLS_6 = __VLS_5({
            ...{ class: "size-3.5" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_5));
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.items.length);
    (__VLS_ctx.runningCount > 0 ? ` (${__VLS_ctx.runningCount} 进行中)` : '');
    if (!__VLS_ctx.collapsed) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "border-t border-gray-100 dark:border-gray-800" },
        });
        for (const [item] of __VLS_getVForSourceType((__VLS_ctx.items))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                key: (item.id),
                ...{ class: "flex items-start gap-2 px-3 py-1.5 text-xs" },
            });
            if (item.status === 'running') {
                const __VLS_8 = {}.Loader2;
                /** @type {[typeof __VLS_components.Loader2, ]} */ ;
                // @ts-ignore
                const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
                    ...{ class: "size-3.5 mt-0.5 shrink-0 animate-spin text-blue-500" },
                }));
                const __VLS_10 = __VLS_9({
                    ...{ class: "size-3.5 mt-0.5 shrink-0 animate-spin text-blue-500" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_9));
            }
            else if (item.status === 'done') {
                const __VLS_12 = {}.CheckCircle2;
                /** @type {[typeof __VLS_components.CheckCircle2, ]} */ ;
                // @ts-ignore
                const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
                    ...{ class: "size-3.5 mt-0.5 shrink-0 text-green-500" },
                }));
                const __VLS_14 = __VLS_13({
                    ...{ class: "size-3.5 mt-0.5 shrink-0 text-green-500" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_13));
            }
            else {
                const __VLS_16 = {}.XCircle;
                /** @type {[typeof __VLS_components.XCircle, ]} */ ;
                // @ts-ignore
                const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
                    ...{ class: "size-3.5 mt-0.5 shrink-0 text-red-500" },
                }));
                const __VLS_18 = __VLS_17({
                    ...{ class: "size-3.5 mt-0.5 shrink-0 text-red-500" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_17));
            }
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "min-w-0 flex-1" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "text-gray-700 dark:text-gray-300" },
            });
            (item.label);
            if (item.detail) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
                    ...{ class: "mt-0.5 truncate text-gray-400" },
                });
                (item.detail);
            }
        }
    }
}
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-50']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:hover:bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['size-3.5']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-spin']} */ ;
/** @type {__VLS_StyleScopedClasses['size-3.5']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['size-3.5']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-spin']} */ ;
/** @type {__VLS_StyleScopedClasses['text-blue-500']} */ ;
/** @type {__VLS_StyleScopedClasses['size-3.5']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-green-500']} */ ;
/** @type {__VLS_StyleScopedClasses['size-3.5']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-500']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            Loader2: Loader2,
            CheckCircle2: CheckCircle2,
            XCircle: XCircle,
            Wrench: Wrench,
            emit: emit,
            hasItems: hasItems,
            runningCount: runningCount,
        };
    },
    __typeEmits: {},
    __typeProps: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    __typeEmits: {},
    __typeProps: {},
});
; /* PartiallyEnd: #4569/main.vue */
