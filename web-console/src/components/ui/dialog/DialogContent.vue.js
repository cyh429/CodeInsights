import { reactiveOmit } from '@vueuse/core';
import { X } from 'lucide-vue-next';
import { DialogClose, DialogContent, DialogPortal, useForwardPropsEmits } from 'reka-ui';
import { cn } from '@/lib/utils';
import DialogOverlay from './DialogOverlay.vue';
const props = defineProps();
const emits = defineEmits();
const delegatedProps = reactiveOmit(props, 'class');
const forwarded = useForwardPropsEmits(delegatedProps, emits);
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
const __VLS_0 = {}.DialogPortal;
/** @type {[typeof __VLS_components.DialogPortal, typeof __VLS_components.DialogPortal, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({}));
const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
var __VLS_4 = {};
__VLS_3.slots.default;
/** @type {[typeof DialogOverlay, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(DialogOverlay, new DialogOverlay({}));
const __VLS_6 = __VLS_5({}, ...__VLS_functionalComponentArgsRest(__VLS_5));
const __VLS_8 = {}.DialogContent;
/** @type {[typeof __VLS_components.DialogContent, typeof __VLS_components.DialogContent, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
    ...(__VLS_ctx.forwarded),
    ...{ class: (__VLS_ctx.cn('fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 max-h-[95%] max-w-[98%] overflow-auto rounded-2xl border border-gray-200 bg-white p-0 z-[1000] shadow-xl dark:border-gray-700 dark:bg-gray-900', props.class)) },
}));
const __VLS_10 = __VLS_9({
    ...(__VLS_ctx.forwarded),
    ...{ class: (__VLS_ctx.cn('fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 max-h-[95%] max-w-[98%] overflow-auto rounded-2xl border border-gray-200 bg-white p-0 z-[1000] shadow-xl dark:border-gray-700 dark:bg-gray-900', props.class)) },
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
__VLS_11.slots.default;
var __VLS_12 = {};
const __VLS_14 = {}.DialogClose;
/** @type {[typeof __VLS_components.DialogClose, typeof __VLS_components.DialogClose, ]} */ ;
// @ts-ignore
const __VLS_15 = __VLS_asFunctionalComponent(__VLS_14, new __VLS_14({
    ...{ class: "absolute top-4 right-4 flex h-7 w-7 items-center justify-center cursor-pointer rounded-md hover:bg-gray-100 dark:hover:bg-gray-800" },
}));
const __VLS_16 = __VLS_15({
    ...{ class: "absolute top-4 right-4 flex h-7 w-7 items-center justify-center cursor-pointer rounded-md hover:bg-gray-100 dark:hover:bg-gray-800" },
}, ...__VLS_functionalComponentArgsRest(__VLS_15));
__VLS_17.slots.default;
const __VLS_18 = {}.X;
/** @type {[typeof __VLS_components.X, ]} */ ;
// @ts-ignore
const __VLS_19 = __VLS_asFunctionalComponent(__VLS_18, new __VLS_18({
    ...{ class: "size-5 text-gray-400" },
}));
const __VLS_20 = __VLS_19({
    ...{ class: "size-5 text-gray-400" },
}, ...__VLS_functionalComponentArgsRest(__VLS_19));
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "sr-only" },
});
var __VLS_17;
var __VLS_11;
var __VLS_3;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['top-4']} */ ;
/** @type {__VLS_StyleScopedClasses['right-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['h-7']} */ ;
/** @type {__VLS_StyleScopedClasses['w-7']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:hover:bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['size-5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['sr-only']} */ ;
// @ts-ignore
var __VLS_13 = __VLS_12;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            X: X,
            DialogClose: DialogClose,
            DialogContent: DialogContent,
            DialogPortal: DialogPortal,
            cn: cn,
            DialogOverlay: DialogOverlay,
            forwarded: forwarded,
        };
    },
    __typeEmits: {},
    __typeProps: {},
});
const __VLS_component = (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    __typeEmits: {},
    __typeProps: {},
});
export default {};
; /* PartiallyEnd: #4569/main.vue */
