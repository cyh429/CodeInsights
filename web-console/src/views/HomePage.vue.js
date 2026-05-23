import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { Cpu, BookOpen, GitBranch, BarChart3 } from 'lucide-vue-next';
import ChatBox from '@/components/chat/ChatBox.vue';
import { useChatStore } from '@/stores/chat';
import { setPendingChat } from '@/composables/usePendingChat';
import { showErrorToast } from '@/utils/toast';
const router = useRouter();
const store = useChatStore();
const message = ref('');
const isSubmitting = ref(false);
const chatBoxRef = ref(null);
const quickPrompts = [
    {
        icon: Cpu,
        title: 'RISC-V 架构',
        description: '了解 RISC-V 指令集、扩展和微架构设计',
        query: '请介绍 RISC-V 的主要指令集扩展及其应用场景',
    },
    {
        icon: GitBranch,
        title: '开源贡献',
        description: '分析 RISC-V 社区的开源项目和贡献流程',
        query: '如何开始为 RISC-V 开源项目做贡献？有哪些推荐的入门项目？',
    },
    {
        icon: BookOpen,
        title: '技术文档',
        description: '查阅 RISC-V 规范、手册和技术报告',
        query: '请帮我梳理 RISC-V 最新的规范文档和重要的技术提案',
    },
    {
        icon: BarChart3,
        title: '生态分析',
        description: '了解 RISC-V 生态系统的发展趋势和关键参与者',
        query: '分析当前 RISC-V 生态系统的主要参与者和发展趋势',
    },
];
function usePrompt(query) {
    message.value = query;
    chatBoxRef.value?.focus();
}
async function handleSubmit() {
    if (!message.value.trim() || isSubmitting.value)
        return;
    isSubmitting.value = true;
    try {
        const res = await store.createSession('chat');
        if (res.code !== 0) {
            showErrorToast(res.msg || '创建会话失败');
            return;
        }
        setPendingChat({ message: message.value, attachments: [] });
        router.push(`/chat/${res.data.session_id}`);
    }
    catch (e) {
        showErrorToast(e.message || '创建会话失败');
    }
    finally {
        isSubmitting.value = false;
    }
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex h-full flex-col items-center justify-center px-4" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "w-full max-w-2xl" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "mb-8 text-center" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({
    ...{ class: "text-3xl font-semibold text-gray-900 dark:text-gray-100" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "mt-2 text-gray-500 dark:text-gray-400" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "mb-6 grid grid-cols-2 gap-3" },
});
for (const [p] of __VLS_getVForSourceType((__VLS_ctx.quickPrompts))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.usePrompt(p.query);
            } },
        key: (p.title),
        ...{ class: "flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left transition-colors hover:border-blue-200 hover:bg-blue-50/50 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-blue-800 dark:hover:bg-blue-900/20" },
    });
    const __VLS_0 = ((p.icon));
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
        ...{ class: "mt-0.5 size-5 shrink-0 text-blue-500" },
    }));
    const __VLS_2 = __VLS_1({
        ...{ class: "mt-0.5 size-5 shrink-0 text-blue-500" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-sm font-medium text-gray-700 dark:text-gray-300" },
    });
    (p.title);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "mt-0.5 text-xs text-gray-400" },
    });
    (p.description);
}
/** @type {[typeof ChatBox, ]} */ ;
// @ts-ignore
const __VLS_4 = __VLS_asFunctionalComponent(ChatBox, new ChatBox({
    ...{ 'onSubmit': {} },
    ref: "chatBoxRef",
    modelValue: (__VLS_ctx.message),
    placeholder: "问我关于 RISC-V 的任何问题...",
}));
const __VLS_5 = __VLS_4({
    ...{ 'onSubmit': {} },
    ref: "chatBoxRef",
    modelValue: (__VLS_ctx.message),
    placeholder: "问我关于 RISC-V 的任何问题...",
}, ...__VLS_functionalComponentArgsRest(__VLS_4));
let __VLS_7;
let __VLS_8;
let __VLS_9;
const __VLS_10 = {
    onSubmit: (__VLS_ctx.handleSubmit)
};
/** @type {typeof __VLS_ctx.chatBoxRef} */ ;
var __VLS_11 = {};
var __VLS_6;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-8']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-3xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:border-blue-200']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-blue-50/50']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:bg-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:hover:border-blue-800']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:hover:bg-blue-900/20']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['size-5']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-blue-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
// @ts-ignore
var __VLS_12 = __VLS_11;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            ChatBox: ChatBox,
            message: message,
            chatBoxRef: chatBoxRef,
            quickPrompts: quickPrompts,
            usePrompt: usePrompt,
            handleSubmit: handleSubmit,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
