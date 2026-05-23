import { reactiveOmit } from '@vueuse/core';
import { DialogDescription, useForwardProps } from 'reka-ui';
import { cn } from '@/lib/utils';
const props = defineProps();
const delegatedProps = reactiveOmit(props, 'class');
const forwardedProps = useForwardProps(delegatedProps);
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
const __VLS_0 = {}.DialogDescription;
/** @type {[typeof __VLS_components.DialogDescription, typeof __VLS_components.DialogDescription, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...(__VLS_ctx.forwardedProps),
    ...{ class: (__VLS_ctx.cn('text-gray-500 dark:text-gray-400 text-sm', props.class)) },
}));
const __VLS_2 = __VLS_1({
    ...(__VLS_ctx.forwardedProps),
    ...{ class: (__VLS_ctx.cn('text-gray-500 dark:text-gray-400 text-sm', props.class)) },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
var __VLS_4 = {};
__VLS_3.slots.default;
var __VLS_5 = {};
var __VLS_3;
// @ts-ignore
var __VLS_6 = __VLS_5;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            DialogDescription: DialogDescription,
            cn: cn,
            forwardedProps: forwardedProps,
        };
    },
    __typeProps: {},
});
const __VLS_component = (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    __typeProps: {},
});
export default {};
; /* PartiallyEnd: #4569/main.vue */
