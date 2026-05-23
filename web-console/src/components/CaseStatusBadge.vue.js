import { computed } from 'vue';
const props = defineProps();
const status = computed(() => props.status);
const statusToColor = {
    created: 'bg-gray-200 text-gray-800',
    exploring: 'bg-blue-500 text-white',
    pending_explore_review: 'bg-yellow-300 text-yellow-800',
    planning: 'bg-blue-500 text-white',
    pending_plan_review: 'bg-yellow-300 text-yellow-800',
    developing: 'bg-blue-500 text-white',
    reviewing: 'bg-blue-500 text-white',
    pending_code_review: 'bg-yellow-300 text-yellow-800',
    testing: 'bg-blue-500 text-white',
    pending_test_review: 'bg-yellow-300 text-yellow-800',
    completed: 'bg-green-500 text-white',
    abandoned: 'bg-red-600 text-white',
};
const badgeClasses = computed(() => `text-xs font-semibold px-2 py-1 rounded-full ${statusToColor[status.value]}`);
const statusLabel = computed(() => String(status.value).replace('_', ' '));
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: (__VLS_ctx.badgeClasses) },
});
(__VLS_ctx.statusLabel);
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            badgeClasses: badgeClasses,
            statusLabel: statusLabel,
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
