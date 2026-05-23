import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { Loader2, AlertCircle } from 'lucide-vue-next';
import ChatMessage from '@/components/chat/ChatMessage.vue';
import { getSharedSession } from '@/api/chat';
const route = useRoute();
const sessionId = ref(route.params.id);
const title = ref('');
const messages = ref([]);
const loading = ref(true);
const error = ref('');
function parseEvents(events) {
    const result = [];
    for (const ev of events) {
        if (ev.type === 'message') {
            const role = ev.data?.role;
            const content = ev.data?.content || '';
            if (role === 'user' || role === 'assistant') {
                result.push({ id: ev.event_id, role, content, timestamp: ev.timestamp });
            }
        }
    }
    return result;
}
onMounted(async () => {
    try {
        const res = await getSharedSession(sessionId.value);
        if (res.code === 0) {
            title.value = res.data.title || '共享对话';
            messages.value = parseEvents(res.data.events || []);
        }
        else {
            error.value = res.msg || '无法加载共享对话';
        }
    }
    catch {
        error.value = '对话不存在或已取消共享';
    }
    finally {
        loading.value = false;
    }
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "mx-auto max-w-3xl px-4 py-6 md:px-8" },
});
if (__VLS_ctx.title) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({
        ...{ class: "mb-4 text-lg font-semibold text-gray-800 dark:text-gray-200" },
    });
    (__VLS_ctx.title);
}
if (__VLS_ctx.loading) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-center justify-center py-16" },
    });
    const __VLS_0 = {}.Loader2;
    /** @type {[typeof __VLS_components.Loader2, ]} */ ;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
        ...{ class: "size-6 animate-spin text-gray-400" },
    }));
    const __VLS_2 = __VLS_1({
        ...{ class: "size-6 animate-spin text-gray-400" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
}
else if (__VLS_ctx.error) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex flex-col items-center gap-3 py-16 text-center" },
    });
    const __VLS_4 = {}.AlertCircle;
    /** @type {[typeof __VLS_components.AlertCircle, ]} */ ;
    // @ts-ignore
    const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
        ...{ class: "size-10 text-gray-300" },
    }));
    const __VLS_6 = __VLS_5({
        ...{ class: "size-10 text-gray-300" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_5));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-sm text-gray-500" },
    });
    (__VLS_ctx.error);
}
else {
    for (const [msg] of __VLS_getVForSourceType((__VLS_ctx.messages))) {
        /** @type {[typeof ChatMessage, ]} */ ;
        // @ts-ignore
        const __VLS_8 = __VLS_asFunctionalComponent(ChatMessage, new ChatMessage({
            key: (msg.id),
            role: (msg.role),
            content: (msg.content),
            timestamp: (msg.timestamp),
        }));
        const __VLS_9 = __VLS_8({
            key: (msg.id),
            role: (msg.role),
            content: (msg.content),
            timestamp: (msg.timestamp),
        }, ...__VLS_functionalComponentArgsRest(__VLS_8));
    }
    if (!__VLS_ctx.messages.length) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "py-8 text-center text-sm text-gray-400" },
        });
    }
}
/** @type {__VLS_StyleScopedClasses['mx-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-3xl']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-6']} */ ;
/** @type {__VLS_StyleScopedClasses['md:px-8']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['py-16']} */ ;
/** @type {__VLS_StyleScopedClasses['size-6']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-spin']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-16']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['size-10']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['py-8']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            Loader2: Loader2,
            AlertCircle: AlertCircle,
            ChatMessage: ChatMessage,
            title: title,
            messages: messages,
            loading: loading,
            error: error,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
