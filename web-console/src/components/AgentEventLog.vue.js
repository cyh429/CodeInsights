import { ref, computed, watch, nextTick } from 'vue';
import { CheckCircle2, XCircle, Loader2, BrainCircuit, Wrench, FileCheck, AlertTriangle, DollarSign, MessageSquare, Activity, ChevronDown, ChevronRight, } from 'lucide-vue-next';
const props = defineProps();
const containerRef = ref(null);
/** Track which tool_result events are expanded (by seq number) */
const expandedResults = ref(new Set());
const TRUNCATE_LIMIT = 200;
function renderEvent(event) {
    const base = {
        seq: event.seq,
        icon: Activity,
        iconColor: 'text-gray-400',
        bgColor: 'bg-gray-50',
        title: event.event_type,
    };
    switch (event.event_type) {
        case 'stage_change': {
            const stage = event.data.stage || 'unknown';
            const status = event.data.status || 'unknown';
            base.icon = status === 'completed' ? CheckCircle2 : Loader2;
            base.iconColor = status === 'completed' ? 'text-green-500' : 'text-blue-500';
            base.bgColor = status === 'completed' ? 'bg-green-50' : 'bg-blue-50';
            base.title = `Stage: ${stage}`;
            base.meta = status;
            break;
        }
        case 'agent_output': {
            const type = event.data.type || 'output';
            if (type === 'thinking') {
                base.icon = BrainCircuit;
                base.iconColor = 'text-purple-500';
                base.bgColor = 'bg-purple-50';
                base.title = 'Thinking';
                base.body = event.data.content || '';
            }
            else if (type === 'tool_call') {
                base.icon = Wrench;
                base.iconColor = 'text-orange-500';
                base.bgColor = 'bg-orange-50';
                base.title = `Tool: ${event.data.tool_name || 'unknown'}`;
                base.toolArgs = (event.data.args || {});
            }
            else if (type === 'tool_result') {
                base.icon = FileCheck;
                base.iconColor = 'text-teal-500';
                base.bgColor = 'bg-teal-50';
                base.title = `Result: ${event.data.tool_name || 'unknown'}`;
                const raw = typeof event.data.result === 'string'
                    ? event.data.result
                    : JSON.stringify(event.data.result || {}, null, 2);
                base.body = raw;
                base.isTruncatable = raw.length > TRUNCATE_LIMIT;
            }
            else {
                base.icon = MessageSquare;
                base.iconColor = 'text-gray-600';
                base.bgColor = 'bg-gray-50';
                base.title = 'Output';
                base.body = event.data.content || JSON.stringify(event.data, null, 2);
            }
            break;
        }
        case 'review_request': {
            base.icon = AlertTriangle;
            base.iconColor = 'text-yellow-500';
            base.bgColor = 'bg-yellow-50';
            base.title = 'Review Requested';
            base.body = `Stage: ${event.data.stage || 'current'}`;
            break;
        }
        case 'cost_update': {
            base.icon = DollarSign;
            base.iconColor = 'text-emerald-500';
            base.bgColor = 'bg-emerald-50';
            base.title = 'Cost Update';
            base.body = `$${(event.data.estimated_cost_usd || 0).toFixed(2)}`;
            base.meta = `${event.data.total_input_tokens || 0} in / ${event.data.total_output_tokens || 0} out`;
            break;
        }
        case 'error': {
            base.icon = XCircle;
            base.iconColor = 'text-red-500';
            base.bgColor = 'bg-red-50';
            base.title = 'Error';
            base.body = event.data.message || 'Unknown error';
            base.meta = event.data.recoverable ? 'Recoverable' : 'Non-recoverable';
            break;
        }
        case 'completed': {
            base.icon = CheckCircle2;
            base.iconColor = 'text-green-600';
            base.bgColor = 'bg-green-50';
            base.title = 'Pipeline Completed';
            break;
        }
        default:
            base.body = JSON.stringify(event.data, null, 2);
    }
    return base;
}
const renderedEvents = computed(() => {
    return [...props.events].reverse().map(renderEvent);
});
function isExpanded(seq) {
    return expandedResults.value.has(seq);
}
function toggleExpand(seq) {
    const next = new Set(expandedResults.value);
    if (next.has(seq)) {
        next.delete(seq);
    }
    else {
        next.add(seq);
    }
    expandedResults.value = next;
}
function displayBody(evt) {
    if (!evt.body)
        return '';
    if (!evt.isTruncatable || isExpanded(evt.seq))
        return evt.body;
    return evt.body.slice(0, TRUNCATE_LIMIT) + '...';
}
function formatArgValue(value) {
    if (typeof value === 'string')
        return value;
    return JSON.stringify(value);
}
// Auto-scroll to top when new events arrive (newest displayed first)
watch(() => props.events.length, () => {
    nextTick(() => {
        if (containerRef.value) {
            containerRef.value.scrollTop = 0;
        }
    });
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ref: "containerRef",
    ...{ class: "space-y-2" },
});
/** @type {typeof __VLS_ctx.containerRef} */ ;
for (const [evt] of __VLS_getVForSourceType((__VLS_ctx.renderedEvents))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        key: (evt.seq),
        ...{ class: "rounded-lg border p-3 text-sm" },
        ...{ class: (evt.bgColor || 'bg-white border-gray-100') },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-center gap-2 mb-1" },
    });
    const __VLS_0 = ((evt.icon));
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
        ...{ class: "w-4 h-4 shrink-0" },
        ...{ class: (evt.iconColor) },
    }));
    const __VLS_2 = __VLS_1({
        ...{ class: "w-4 h-4 shrink-0" },
        ...{ class: (evt.iconColor) },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "font-medium text-gray-700" },
    });
    (evt.title);
    if (evt.meta) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "ml-auto text-xs px-2 py-0.5 rounded-full bg-white/70 text-gray-500" },
        });
        (evt.meta);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "text-xs text-gray-400 font-mono" },
    });
    (evt.seq);
    if (evt.toolArgs && Object.keys(evt.toolArgs).length > 0) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.table, __VLS_intrinsicElements.table)({
            ...{ class: "mt-1 w-full text-xs font-mono bg-white/50 rounded overflow-hidden" },
        });
        for (const [val, key] of __VLS_getVForSourceType((evt.toolArgs))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({
                key: (String(key)),
                ...{ class: "border-b border-gray-100 last:border-b-0" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
                ...{ class: "px-2 py-1 text-gray-500 font-medium whitespace-nowrap align-top w-1/4" },
            });
            (key);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
                ...{ class: "px-2 py-1 text-gray-700 break-all" },
            });
            (__VLS_ctx.formatArgValue(val));
        }
    }
    if (evt.body) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.pre, __VLS_intrinsicElements.pre)({
            ...{ class: "mt-1 text-xs text-gray-600 whitespace-pre-wrap break-words font-mono bg-white/50 rounded p-2" },
        });
        (__VLS_ctx.displayBody(evt));
        if (evt.isTruncatable) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(evt.body))
                            return;
                        if (!(evt.isTruncatable))
                            return;
                        __VLS_ctx.toggleExpand(evt.seq);
                    } },
                ...{ class: "mt-1 text-xs font-medium flex items-center gap-1 transition-colors" },
                ...{ class: (__VLS_ctx.isExpanded(evt.seq) ? 'text-blue-600 hover:text-blue-800' : 'text-gray-500 hover:text-gray-700') },
            });
            const __VLS_4 = ((__VLS_ctx.isExpanded(evt.seq) ? __VLS_ctx.ChevronDown : __VLS_ctx.ChevronRight));
            // @ts-ignore
            const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
                ...{ class: "w-3 h-3" },
            }));
            const __VLS_6 = __VLS_5({
                ...{ class: "w-3 h-3" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_5));
            (__VLS_ctx.isExpanded(evt.seq) ? 'Show less' : 'Show more');
        }
    }
}
/** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white/70']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white/50']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['last:border-b-0']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['whitespace-nowrap']} */ ;
/** @type {__VLS_StyleScopedClasses['align-top']} */ ;
/** @type {__VLS_StyleScopedClasses['w-1/4']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['break-all']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['whitespace-pre-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['break-words']} */ ;
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white/50']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['w-3']} */ ;
/** @type {__VLS_StyleScopedClasses['h-3']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            ChevronDown: ChevronDown,
            ChevronRight: ChevronRight,
            containerRef: containerRef,
            renderedEvents: renderedEvents,
            isExpanded: isExpanded,
            toggleExpand: toggleExpand,
            displayBody: displayBody,
            formatArgValue: formatArgValue,
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
