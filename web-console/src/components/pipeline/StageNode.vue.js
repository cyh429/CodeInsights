import { computed } from 'vue';
import { Circle, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-vue-next';
const { stage, isCurrent, isLast } = defineProps();
const statusIcon = computed(() => {
    const icons = {
        pending: Circle,
        running: Loader2,
        completed: CheckCircle2,
        failed: XCircle,
        waiting_review: Clock,
    };
    return icons[stage.status] ?? Circle;
});
const ringClasses = computed(() => {
    const base = {
        pending: 'bg-gray-100 border-2 border-gray-300',
        running: 'bg-blue-50 border-2 border-blue-500 ring-2 ring-blue-200 animate-pulse',
        completed: 'bg-green-50 border-2 border-green-500',
        failed: 'bg-red-50 border-2 border-red-500',
        waiting_review: 'bg-yellow-50 border-2 border-yellow-400 ring-2 ring-yellow-200 animate-pulse',
    };
    return base[stage.status] ?? 'bg-gray-100 border-2 border-gray-300';
});
const iconClasses = computed(() => {
    const base = {
        pending: 'text-gray-400',
        running: 'text-blue-500 animate-spin',
        completed: 'text-green-500',
        failed: 'text-red-500',
        waiting_review: 'text-yellow-500',
    };
    return base[stage.status] ?? 'text-gray-400';
});
const connectorClasses = computed(() => {
    if (stage.status === 'completed')
        return 'bg-green-400';
    if (stage.status === 'running' || stage.status === 'waiting_review')
        return 'bg-blue-300';
    return 'bg-gray-200';
});
const labelClasses = computed(() => {
    if (stage.status === 'completed')
        return 'text-green-700';
    if (stage.status === 'running')
        return 'text-blue-700';
    if (stage.status === 'waiting_review')
        return 'text-yellow-700';
    if (stage.status === 'failed')
        return 'text-red-700';
    return 'text-gray-500';
});
function formatDuration(start, end) {
    if (!start || !end)
        return '';
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms < 1000)
        return '<1s';
    const s = Math.floor(ms / 1000);
    if (s < 60)
        return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-start gap-3 relative" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex flex-col items-center" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-300" },
    ...{ class: (__VLS_ctx.ringClasses) },
});
const __VLS_0 = ((__VLS_ctx.statusIcon));
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ class: "w-4 h-4" },
    ...{ class: (__VLS_ctx.iconClasses) },
}));
const __VLS_2 = __VLS_1({
    ...{ class: "w-4 h-4" },
    ...{ class: (__VLS_ctx.iconClasses) },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
if (!isLast) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div)({
        ...{ class: "w-0.5 h-8 mt-1" },
        ...{ class: (__VLS_ctx.connectorClasses) },
    });
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "pt-1 min-w-0" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "text-sm font-medium" },
    ...{ class: (__VLS_ctx.labelClasses) },
});
(stage.label);
if (stage.status === 'waiting_review') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-xs text-yellow-600 mt-0.5" },
    });
}
if (stage.completedAt) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-xs text-gray-400 mt-0.5" },
    });
    (__VLS_ctx.formatDuration(stage.startedAt, stage.completedAt));
}
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['w-8']} */ ;
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
/** @type {__VLS_StyleScopedClasses['duration-300']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-yellow-600']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            statusIcon: statusIcon,
            ringClasses: ringClasses,
            iconClasses: iconClasses,
            connectorClasses: connectorClasses,
            labelClasses: labelClasses,
            formatDuration: formatDuration,
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
