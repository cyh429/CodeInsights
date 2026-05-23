import { ref, onMounted, onUnmounted } from 'vue';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-vue-next';
const toasts = ref([]);
let nextId = 0;
function addToast(e) {
    const { message, type, duration } = e.detail;
    const id = nextId++;
    toasts.value = [...toasts.value, { id, message, type, duration }];
    if (duration > 0) {
        setTimeout(() => removeToast(id), duration);
    }
}
function removeToast(id) {
    toasts.value = toasts.value.filter((t) => t.id !== id);
}
const iconMap = { success: CheckCircle2, error: AlertCircle, info: Info };
const colorMap = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
};
onMounted(() => window.addEventListener('toast', addToast));
onUnmounted(() => window.removeEventListener('toast', addToast));
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
// CSS variable injection 
// CSS variable injection end 
const __VLS_0 = {}.Teleport;
/** @type {[typeof __VLS_components.Teleport, typeof __VLS_components.Teleport, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    to: "body",
}));
const __VLS_2 = __VLS_1({
    to: "body",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_3.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm" },
});
const __VLS_4 = {}.TransitionGroup;
/** @type {[typeof __VLS_components.TransitionGroup, typeof __VLS_components.TransitionGroup, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
    name: "toast",
}));
const __VLS_6 = __VLS_5({
    name: "toast",
}, ...__VLS_functionalComponentArgsRest(__VLS_5));
__VLS_7.slots.default;
for (const [toast] of __VLS_getVForSourceType((__VLS_ctx.toasts))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        key: (toast.id),
        ...{ class: (['flex items-start gap-2 px-4 py-3 rounded-lg border shadow-lg', __VLS_ctx.colorMap[toast.type]]) },
    });
    const __VLS_8 = ((__VLS_ctx.iconMap[toast.type]));
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
        ...{ class: "size-5 shrink-0 mt-0.5" },
    }));
    const __VLS_10 = __VLS_9({
        ...{ class: "size-5 shrink-0 mt-0.5" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_9));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "text-sm flex-1" },
    });
    (toast.message);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.removeToast(toast.id);
            } },
        ...{ class: "shrink-0 p-0.5 rounded hover:bg-black/5" },
    });
    const __VLS_12 = {}.X;
    /** @type {[typeof __VLS_components.X, ]} */ ;
    // @ts-ignore
    const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
        ...{ class: "size-4" },
    }));
    const __VLS_14 = __VLS_13({
        ...{ class: "size-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_13));
}
var __VLS_7;
var __VLS_3;
/** @type {__VLS_StyleScopedClasses['fixed']} */ ;
/** @type {__VLS_StyleScopedClasses['top-4']} */ ;
/** @type {__VLS_StyleScopedClasses['right-4']} */ ;
/** @type {__VLS_StyleScopedClasses['z-[9999]']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['size-5']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['p-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-black/5']} */ ;
/** @type {__VLS_StyleScopedClasses['size-4']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            X: X,
            toasts: toasts,
            removeToast: removeToast,
            iconMap: iconMap,
            colorMap: colorMap,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
