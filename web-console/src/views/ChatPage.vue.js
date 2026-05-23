import { ref, onMounted, nextTick, watch } from 'vue';
import { useRoute } from 'vue-router';
import { Loader2 } from 'lucide-vue-next';
import ChatBox from '@/components/chat/ChatBox.vue';
import ChatMessage from '@/components/chat/ChatMessage.vue';
import SuggestedQuestions from '@/components/chat/SuggestedQuestions.vue';
import ActivityPanel from '@/components/shared/ActivityPanel.vue';
import PlanPanel from '@/components/chat/PlanPanel.vue';
import ToolPanel from '@/components/chat/ToolPanel.vue';
import FilePanel from '@/components/chat/FilePanel.vue';
import { useChatStore } from '@/stores/chat';
import { connectChatSSE, stopChat } from '@/api/chat';
import { consumePendingChat } from '@/composables/usePendingChat';
import { useRightPanel } from '@/composables/useRightPanel';
import { useFilePanel } from '@/composables/useFilePanel';
import { extractXmlTags } from '@/utils/markdownFormatter';
const route = useRoute();
const store = useChatStore();
const { panelType, closePanel } = useRightPanel();
const filePanel = useFilePanel();
const sessionId = ref(route.params.id);
const messages = ref([]);
const input = ref('');
const isLoading = ref(false);
const streamingContent = ref('');
const streamingEventId = ref('');
const suggestedQuestions = ref([]);
const activityItems = ref([]);
const activityCollapsed = ref(true);
const planSteps = ref([]);
const planCollapsed = ref(false);
const toolCalls = ref([]);
const scrollRef = ref(null);
const chatBoxRef = ref(null);
let abortController = null;
const processedEventIds = new Set();
function scrollToBottom() {
    nextTick(() => {
        if (scrollRef.value) {
            scrollRef.value.scrollTop = scrollRef.value.scrollHeight;
        }
    });
}
function restoreSession(events) {
    for (const ev of events) {
        if (processedEventIds.has(ev.event_id))
            continue;
        processedEventIds.add(ev.event_id);
        if (ev.type === 'message') {
            const role = ev.data?.role;
            const content = ev.data?.content || '';
            if (role === 'user' || role === 'assistant') {
                messages.value = [
                    ...messages.value,
                    { id: ev.event_id, role, content, timestamp: ev.timestamp },
                ];
            }
        }
    }
}
function handleSSEEvent(event, data) {
    const eventId = data.event_id || '';
    if (eventId && processedEventIds.has(eventId))
        return;
    if (eventId)
        processedEventIds.add(eventId);
    switch (event) {
        case 'message_chunk': {
            if (streamingEventId.value !== eventId && eventId) {
                streamingEventId.value = eventId;
                streamingContent.value = '';
            }
            streamingContent.value += data.content || '';
            scrollToBottom();
            break;
        }
        case 'message_chunk_done': {
            if (streamingContent.value) {
                const { cleanedText, tags } = extractXmlTags(streamingContent.value);
                messages.value = [
                    ...messages.value,
                    {
                        id: streamingEventId.value || eventId,
                        role: 'assistant',
                        content: cleanedText,
                        timestamp: data.timestamp || Date.now() / 1000,
                    },
                ];
                if (tags.suggested_questions) {
                    try {
                        const parsed = JSON.parse(tags.suggested_questions);
                        suggestedQuestions.value = Array.isArray(parsed) ? parsed : [];
                    }
                    catch {
                        suggestedQuestions.value = tags.suggested_questions
                            .split('\n')
                            .map((s) => s.trim())
                            .filter(Boolean);
                    }
                }
            }
            streamingContent.value = '';
            streamingEventId.value = '';
            scrollToBottom();
            break;
        }
        case 'done': {
            isLoading.value = false;
            store.isStreaming = false;
            store.fetchSessions();
            break;
        }
        case 'error': {
            isLoading.value = false;
            store.isStreaming = false;
            if (data.error) {
                messages.value = [
                    ...messages.value,
                    {
                        id: eventId || `err-${Date.now()}`,
                        role: 'assistant',
                        content: `**错误**: ${data.error}`,
                        timestamp: Date.now() / 1000,
                    },
                ];
            }
            break;
        }
        case 'thinking': {
            activityItems.value = [
                ...activityItems.value,
                { id: eventId, type: 'thinking', label: '思考中...', status: 'running', timestamp: Date.now() / 1000 },
            ];
            break;
        }
        case 'tool': {
            const label = data.tool_name || data.name || '工具调用';
            const status = data.status === 'called' ? 'done' : data.status === 'error' ? 'error' : 'running';
            activityItems.value = [
                ...activityItems.value,
                {
                    id: eventId,
                    type: 'tool_call',
                    label,
                    status,
                    timestamp: Date.now() / 1000,
                    detail: data.content?.substring(0, 100),
                },
            ];
            const toolCallId = data.tool_call_id || eventId;
            const existing = toolCalls.value.find((tc) => tc.toolCallId === toolCallId);
            if (existing) {
                toolCalls.value = toolCalls.value.map((tc) => tc.toolCallId === toolCallId
                    ? { ...tc, status: data.status || tc.status, content: data.content || tc.content }
                    : tc);
            }
            else {
                toolCalls.value = [
                    ...toolCalls.value,
                    {
                        toolCallId,
                        name: data.name || data.tool_name || '',
                        args: data.args || {},
                        status: data.status || 'calling',
                        content: data.content || '',
                    },
                ];
            }
            break;
        }
        case 'plan': {
            const steps = data.steps || [];
            planSteps.value = steps.map((s, i) => ({
                id: s.id || `step-${i}`,
                label: s.label || s.title || `步骤 ${i + 1}`,
                status: s.status || 'pending',
                detail: s.detail,
            }));
            break;
        }
        case 'step': {
            const stepId = data.step_id || data.id;
            if (stepId) {
                planSteps.value = planSteps.value.map((s) => s.id === stepId ? { ...s, status: data.status || s.status, detail: data.detail || s.detail } : s);
            }
            break;
        }
    }
}
function sendMessage(text) {
    if (!text.trim() || isLoading.value)
        return;
    messages.value = [
        ...messages.value,
        { id: `user-${Date.now()}`, role: 'user', content: text, timestamp: Date.now() / 1000 },
    ];
    input.value = '';
    suggestedQuestions.value = [];
    activityItems.value = [];
    planSteps.value = [];
    toolCalls.value = [];
    isLoading.value = true;
    store.isStreaming = true;
    scrollToBottom();
    abortController = connectChatSSE(sessionId.value, { message: text }, {
        onMessage: handleSSEEvent,
        onError: () => {
            isLoading.value = false;
            store.isStreaming = false;
        },
    });
}
function handleSubmit() {
    sendMessage(input.value);
}
async function handleStop() {
    abortController?.abort();
    abortController = null;
    await stopChat(sessionId.value);
    isLoading.value = false;
    store.isStreaming = false;
}
function handleSuggestionClick(question) {
    sendMessage(question);
}
function handleFileUpload() {
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = async () => {
        const file = input.files?.[0];
        if (file) {
            await filePanel.upload(sessionId.value, file);
        }
    };
    input.click();
}
onMounted(async () => {
    const res = await store.fetchSession(sessionId.value);
    if (res?.code === 0 && res.data.events) {
        restoreSession(res.data.events);
        scrollToBottom();
    }
    filePanel.loadFiles(sessionId.value);
    const pending = consumePendingChat();
    if (pending?.message) {
        sendMessage(pending.message);
    }
    chatBoxRef.value?.focus();
});
watch(() => route.params.id, (newId) => {
    if (newId && newId !== sessionId.value) {
        sessionId.value = newId;
        messages.value = [];
        streamingContent.value = '';
        processedEventIds.clear();
        suggestedQuestions.value = [];
        activityItems.value = [];
        planSteps.value = [];
        toolCalls.value = [];
        abortController?.abort();
        abortController = null;
        isLoading.value = false;
        store.isStreaming = false;
        closePanel();
        filePanel.clearFiles();
        store.fetchSession(sessionId.value).then((res) => {
            if (res?.code === 0 && res.data.events) {
                restoreSession(res.data.events);
                scrollToBottom();
            }
        });
        filePanel.loadFiles(sessionId.value);
    }
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex h-full" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex flex-1 flex-col overflow-hidden" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ref: "scrollRef",
    ...{ class: "flex-1 overflow-y-auto px-4 md:px-8 lg:px-16" },
});
/** @type {typeof __VLS_ctx.scrollRef} */ ;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "mx-auto max-w-3xl py-4" },
});
for (const [msg] of __VLS_getVForSourceType((__VLS_ctx.messages))) {
    /** @type {[typeof ChatMessage, ]} */ ;
    // @ts-ignore
    const __VLS_0 = __VLS_asFunctionalComponent(ChatMessage, new ChatMessage({
        key: (msg.id),
        role: (msg.role),
        content: (msg.content),
        timestamp: (msg.timestamp),
    }));
    const __VLS_1 = __VLS_0({
        key: (msg.id),
        role: (msg.role),
        content: (msg.content),
        timestamp: (msg.timestamp),
    }, ...__VLS_functionalComponentArgsRest(__VLS_0));
}
if (__VLS_ctx.streamingContent) {
    /** @type {[typeof ChatMessage, ]} */ ;
    // @ts-ignore
    const __VLS_3 = __VLS_asFunctionalComponent(ChatMessage, new ChatMessage({
        role: "assistant",
        content: (__VLS_ctx.streamingContent),
        streaming: (true),
    }));
    const __VLS_4 = __VLS_3({
        role: "assistant",
        content: (__VLS_ctx.streamingContent),
        streaming: (true),
    }, ...__VLS_functionalComponentArgsRest(__VLS_3));
}
if (__VLS_ctx.isLoading && !__VLS_ctx.streamingContent) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-center gap-2 py-4" },
    });
    const __VLS_6 = {}.Loader2;
    /** @type {[typeof __VLS_components.Loader2, ]} */ ;
    // @ts-ignore
    const __VLS_7 = __VLS_asFunctionalComponent(__VLS_6, new __VLS_6({
        ...{ class: "size-4 animate-spin text-gray-400" },
    }));
    const __VLS_8 = __VLS_7({
        ...{ class: "size-4 animate-spin text-gray-400" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_7));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "text-sm text-gray-400" },
    });
}
/** @type {[typeof PlanPanel, ]} */ ;
// @ts-ignore
const __VLS_10 = __VLS_asFunctionalComponent(PlanPanel, new PlanPanel({
    ...{ 'onToggle': {} },
    steps: (__VLS_ctx.planSteps),
    collapsed: (__VLS_ctx.planCollapsed),
}));
const __VLS_11 = __VLS_10({
    ...{ 'onToggle': {} },
    steps: (__VLS_ctx.planSteps),
    collapsed: (__VLS_ctx.planCollapsed),
}, ...__VLS_functionalComponentArgsRest(__VLS_10));
let __VLS_13;
let __VLS_14;
let __VLS_15;
const __VLS_16 = {
    onToggle: (...[$event]) => {
        __VLS_ctx.planCollapsed = !__VLS_ctx.planCollapsed;
    }
};
var __VLS_12;
/** @type {[typeof ActivityPanel, ]} */ ;
// @ts-ignore
const __VLS_17 = __VLS_asFunctionalComponent(ActivityPanel, new ActivityPanel({
    ...{ 'onToggle': {} },
    items: (__VLS_ctx.activityItems),
    collapsed: (__VLS_ctx.activityCollapsed),
}));
const __VLS_18 = __VLS_17({
    ...{ 'onToggle': {} },
    items: (__VLS_ctx.activityItems),
    collapsed: (__VLS_ctx.activityCollapsed),
}, ...__VLS_functionalComponentArgsRest(__VLS_17));
let __VLS_20;
let __VLS_21;
let __VLS_22;
const __VLS_23 = {
    onToggle: (...[$event]) => {
        __VLS_ctx.activityCollapsed = !__VLS_ctx.activityCollapsed;
    }
};
var __VLS_19;
/** @type {[typeof SuggestedQuestions, ]} */ ;
// @ts-ignore
const __VLS_24 = __VLS_asFunctionalComponent(SuggestedQuestions, new SuggestedQuestions({
    ...{ 'onClick': {} },
    questions: (__VLS_ctx.suggestedQuestions),
}));
const __VLS_25 = __VLS_24({
    ...{ 'onClick': {} },
    questions: (__VLS_ctx.suggestedQuestions),
}, ...__VLS_functionalComponentArgsRest(__VLS_24));
let __VLS_27;
let __VLS_28;
let __VLS_29;
const __VLS_30 = {
    onClick: (__VLS_ctx.handleSuggestionClick)
};
var __VLS_26;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "border-t border-gray-100 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900 md:px-8 lg:px-16" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "mx-auto max-w-3xl" },
});
/** @type {[typeof ChatBox, ]} */ ;
// @ts-ignore
const __VLS_31 = __VLS_asFunctionalComponent(ChatBox, new ChatBox({
    ...{ 'onSubmit': {} },
    ...{ 'onStop': {} },
    ref: "chatBoxRef",
    modelValue: (__VLS_ctx.input),
    isRunning: (__VLS_ctx.isLoading),
}));
const __VLS_32 = __VLS_31({
    ...{ 'onSubmit': {} },
    ...{ 'onStop': {} },
    ref: "chatBoxRef",
    modelValue: (__VLS_ctx.input),
    isRunning: (__VLS_ctx.isLoading),
}, ...__VLS_functionalComponentArgsRest(__VLS_31));
let __VLS_34;
let __VLS_35;
let __VLS_36;
const __VLS_37 = {
    onSubmit: (__VLS_ctx.handleSubmit)
};
const __VLS_38 = {
    onStop: (__VLS_ctx.handleStop)
};
/** @type {typeof __VLS_ctx.chatBoxRef} */ ;
var __VLS_39 = {};
var __VLS_33;
if (__VLS_ctx.panelType) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "w-80 shrink-0" },
    });
    if (__VLS_ctx.panelType === 'tool') {
        /** @type {[typeof ToolPanel, ]} */ ;
        // @ts-ignore
        const __VLS_41 = __VLS_asFunctionalComponent(ToolPanel, new ToolPanel({
            ...{ 'onClose': {} },
            toolCalls: (__VLS_ctx.toolCalls),
        }));
        const __VLS_42 = __VLS_41({
            ...{ 'onClose': {} },
            toolCalls: (__VLS_ctx.toolCalls),
        }, ...__VLS_functionalComponentArgsRest(__VLS_41));
        let __VLS_44;
        let __VLS_45;
        let __VLS_46;
        const __VLS_47 = {
            onClose: (__VLS_ctx.closePanel)
        };
        var __VLS_43;
    }
    if (__VLS_ctx.panelType === 'file') {
        /** @type {[typeof FilePanel, ]} */ ;
        // @ts-ignore
        const __VLS_48 = __VLS_asFunctionalComponent(FilePanel, new FilePanel({
            ...{ 'onClose': {} },
            ...{ 'onSelect': {} },
            ...{ 'onUpload': {} },
            files: (__VLS_ctx.filePanel.files.value),
            selectedFileId: (__VLS_ctx.filePanel.selectedFileId.value),
        }));
        const __VLS_49 = __VLS_48({
            ...{ 'onClose': {} },
            ...{ 'onSelect': {} },
            ...{ 'onUpload': {} },
            files: (__VLS_ctx.filePanel.files.value),
            selectedFileId: (__VLS_ctx.filePanel.selectedFileId.value),
        }, ...__VLS_functionalComponentArgsRest(__VLS_48));
        let __VLS_51;
        let __VLS_52;
        let __VLS_53;
        const __VLS_54 = {
            onClose: (__VLS_ctx.closePanel)
        };
        const __VLS_55 = {
            onSelect: (__VLS_ctx.filePanel.selectFile)
        };
        const __VLS_56 = {
            onUpload: (__VLS_ctx.handleFileUpload)
        };
        var __VLS_50;
    }
}
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['md:px-8']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:px-16']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-3xl']} */ ;
/** @type {__VLS_StyleScopedClasses['py-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-4']} */ ;
/** @type {__VLS_StyleScopedClasses['size-4']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-spin']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:bg-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['md:px-8']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:px-16']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-3xl']} */ ;
/** @type {__VLS_StyleScopedClasses['w-80']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
// @ts-ignore
var __VLS_40 = __VLS_39;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            Loader2: Loader2,
            ChatBox: ChatBox,
            ChatMessage: ChatMessage,
            SuggestedQuestions: SuggestedQuestions,
            ActivityPanel: ActivityPanel,
            PlanPanel: PlanPanel,
            ToolPanel: ToolPanel,
            FilePanel: FilePanel,
            panelType: panelType,
            closePanel: closePanel,
            filePanel: filePanel,
            messages: messages,
            input: input,
            isLoading: isLoading,
            streamingContent: streamingContent,
            suggestedQuestions: suggestedQuestions,
            activityItems: activityItems,
            activityCollapsed: activityCollapsed,
            planSteps: planSteps,
            planCollapsed: planCollapsed,
            toolCalls: toolCalls,
            scrollRef: scrollRef,
            chatBoxRef: chatBoxRef,
            handleSubmit: handleSubmit,
            handleStop: handleStop,
            handleSuggestionClick: handleSuggestionClick,
            handleFileUpload: handleFileUpload,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
