import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { Plus, Search, X, Pin, PinOff, Pencil, Trash2, MessageSquare, ChevronDown, ChevronRight, Share2, Link2Off, } from 'lucide-vue-next';
import { useChatStore } from '@/stores/chat';
import { useSessionGrouping } from '@/composables/useSessionGrouping';
import { useSessionNotifications } from '@/composables/useSessionNotifications';
import { shareSession, unshareSession } from '@/api/chat';
import { formatCustomTime } from '@/utils/time';
const router = useRouter();
const route = useRoute();
const store = useChatStore();
const { groupedSessions, searchQuery, activeFilter, stats, setFilter, setSearchQuery, toggleGroupCollapse } = useSessionGrouping(() => store.sortedSessions);
const { onSessionCreated, onSessionUpdated } = useSessionNotifications();
const editingId = ref(null);
const editTitle = ref('');
onMounted(() => {
    store.fetchSessions();
});
onSessionCreated(() => store.fetchSessions());
onSessionUpdated(() => store.fetchSessions());
async function handleNewChat() {
    const res = await store.createSession('chat');
    if (res.code === 0) {
        router.push(`/chat/${res.data.session_id}`);
    }
}
function handleSessionClick(sessionId) {
    router.push(`/chat/${sessionId}`);
}
async function handlePin(sessionId, pinned) {
    await store.pinSession(sessionId, !pinned);
}
function startRename(sessionId, currentTitle) {
    editingId.value = sessionId;
    editTitle.value = currentTitle || '';
}
async function finishRename(sessionId) {
    if (editTitle.value.trim()) {
        await store.renameSession(sessionId, editTitle.value.trim());
    }
    editingId.value = null;
}
async function handleDelete(sessionId) {
    await store.removeSession(sessionId);
    if (route.params.id === sessionId) {
        router.push('/');
    }
}
async function handleToggleShare(sessionId, isShared) {
    if (isShared) {
        await unshareSession(sessionId);
    }
    else {
        const res = await shareSession(sessionId);
        if (res.code === 0 && res.data.share_url) {
            await navigator.clipboard.writeText(window.location.origin + res.data.share_url);
        }
    }
    await store.fetchSessions();
}
const filters = [
    { key: 'all', label: '全部' },
    { key: 'pinned', label: '置顶' },
    { key: 'running', label: '进行中' },
];
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex h-full w-64 flex-col border-r border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-center justify-between p-3" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "text-sm font-medium text-gray-700 dark:text-gray-300" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.handleNewChat) },
    ...{ class: "flex size-7 items-center justify-center rounded-md hover:bg-gray-200 dark:hover:bg-gray-800" },
});
const __VLS_0 = {}.Plus;
/** @type {[typeof __VLS_components.Plus, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ class: "size-4 text-gray-500" },
}));
const __VLS_2 = __VLS_1({
    ...{ class: "size-4 text-gray-500" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "px-3 pb-2" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "relative" },
});
const __VLS_4 = {}.Search;
/** @type {[typeof __VLS_components.Search, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
    ...{ class: "absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" },
}));
const __VLS_6 = __VLS_5({
    ...{ class: "absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" },
}, ...__VLS_functionalComponentArgsRest(__VLS_5));
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    ...{ onInput: (...[$event]) => {
            __VLS_ctx.setSearchQuery($event.target.value);
        } },
    value: (__VLS_ctx.searchQuery),
    placeholder: "搜索会话...",
    ...{ class: "w-full rounded-lg border border-gray-200 bg-white py-1.5 pl-8 pr-8 text-xs dark:border-gray-700 dark:bg-gray-800" },
});
if (__VLS_ctx.searchQuery) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.searchQuery))
                    return;
                __VLS_ctx.setSearchQuery('');
            } },
        ...{ class: "absolute right-2 top-1/2 -translate-y-1/2" },
    });
    const __VLS_8 = {}.X;
    /** @type {[typeof __VLS_components.X, ]} */ ;
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
        ...{ class: "size-3.5 text-gray-400" },
    }));
    const __VLS_10 = __VLS_9({
        ...{ class: "size-3.5 text-gray-400" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_9));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex gap-1 px-3 pb-2" },
});
for (const [f] of __VLS_getVForSourceType((__VLS_ctx.filters))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.setFilter(f.key);
            } },
        key: (f.key),
        ...{ class: "rounded-md px-2 py-1 text-xs transition-colors" },
        ...{ class: (__VLS_ctx.activeFilter === f.key
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800') },
    });
    (f.label);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex-1 overflow-y-auto px-2" },
});
for (const [group] of __VLS_getVForSourceType((__VLS_ctx.groupedSessions))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        key: (group.key),
        ...{ class: "mb-1" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.toggleGroupCollapse(group.key);
            } },
        ...{ class: "flex w-full items-center gap-1 px-1 py-1 text-[10px] font-medium uppercase tracking-wider text-gray-400" },
    });
    if (!group.collapsed) {
        const __VLS_12 = {}.ChevronDown;
        /** @type {[typeof __VLS_components.ChevronDown, ]} */ ;
        // @ts-ignore
        const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
            ...{ class: "size-3" },
        }));
        const __VLS_14 = __VLS_13({
            ...{ class: "size-3" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_13));
    }
    else {
        const __VLS_16 = {}.ChevronRight;
        /** @type {[typeof __VLS_components.ChevronRight, ]} */ ;
        // @ts-ignore
        const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
            ...{ class: "size-3" },
        }));
        const __VLS_18 = __VLS_17({
            ...{ class: "size-3" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_17));
    }
    (group.label);
    if (!group.collapsed) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        for (const [s] of __VLS_getVForSourceType((group.sessions))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ onClick: (...[$event]) => {
                        if (!(!group.collapsed))
                            return;
                        __VLS_ctx.handleSessionClick(s.session_id);
                    } },
                key: (s.session_id),
                ...{ class: "group flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-gray-200 dark:hover:bg-gray-800" },
                ...{ class: (__VLS_ctx.route.params.id === s.session_id ? 'bg-gray-200 dark:bg-gray-800' : '') },
            });
            const __VLS_20 = {}.MessageSquare;
            /** @type {[typeof __VLS_components.MessageSquare, ]} */ ;
            // @ts-ignore
            const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
                ...{ class: "size-4 shrink-0 text-gray-400" },
            }));
            const __VLS_22 = __VLS_21({
                ...{ class: "size-4 shrink-0 text-gray-400" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_21));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "min-w-0 flex-1" },
            });
            if (__VLS_ctx.editingId === s.session_id) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ onClick: () => { } },
                    ...{ class: "flex gap-1" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
                    ...{ onKeydown: (...[$event]) => {
                            if (!(!group.collapsed))
                                return;
                            if (!(__VLS_ctx.editingId === s.session_id))
                                return;
                            __VLS_ctx.finishRename(s.session_id);
                        } },
                    ...{ onBlur: (...[$event]) => {
                            if (!(!group.collapsed))
                                return;
                            if (!(__VLS_ctx.editingId === s.session_id))
                                return;
                            __VLS_ctx.finishRename(s.session_id);
                        } },
                    ...{ class: "w-full rounded border px-1 text-xs dark:bg-gray-800" },
                });
                (__VLS_ctx.editTitle);
            }
            else {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
                    ...{ class: "truncate text-xs text-gray-700 dark:text-gray-300" },
                });
                (s.title || s.latest_message || '新会话');
                __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
                    ...{ class: "text-[10px] text-gray-400" },
                });
                (s.latest_message_at ? __VLS_ctx.formatCustomTime(s.latest_message_at) : '');
            }
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ onClick: () => { } },
                ...{ class: "flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(!group.collapsed))
                            return;
                        __VLS_ctx.handleToggleShare(s.session_id, s.is_shared);
                    } },
                ...{ class: "rounded p-0.5 hover:bg-gray-300 dark:hover:bg-gray-700" },
                title: (s.is_shared ? '取消分享' : '分享'),
            });
            if (s.is_shared) {
                const __VLS_24 = {}.Link2Off;
                /** @type {[typeof __VLS_components.Link2Off, ]} */ ;
                // @ts-ignore
                const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
                    ...{ class: "size-3 text-blue-400" },
                }));
                const __VLS_26 = __VLS_25({
                    ...{ class: "size-3 text-blue-400" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_25));
            }
            else {
                const __VLS_28 = {}.Share2;
                /** @type {[typeof __VLS_components.Share2, ]} */ ;
                // @ts-ignore
                const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
                    ...{ class: "size-3 text-gray-400" },
                }));
                const __VLS_30 = __VLS_29({
                    ...{ class: "size-3 text-gray-400" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_29));
            }
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(!group.collapsed))
                            return;
                        __VLS_ctx.handlePin(s.session_id, s.pinned);
                    } },
                ...{ class: "rounded p-0.5 hover:bg-gray-300 dark:hover:bg-gray-700" },
            });
            if (s.pinned) {
                const __VLS_32 = {}.PinOff;
                /** @type {[typeof __VLS_components.PinOff, ]} */ ;
                // @ts-ignore
                const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
                    ...{ class: "size-3 text-gray-400" },
                }));
                const __VLS_34 = __VLS_33({
                    ...{ class: "size-3 text-gray-400" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_33));
            }
            else {
                const __VLS_36 = {}.Pin;
                /** @type {[typeof __VLS_components.Pin, ]} */ ;
                // @ts-ignore
                const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
                    ...{ class: "size-3 text-gray-400" },
                }));
                const __VLS_38 = __VLS_37({
                    ...{ class: "size-3 text-gray-400" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_37));
            }
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(!group.collapsed))
                            return;
                        __VLS_ctx.startRename(s.session_id, s.title);
                    } },
                ...{ class: "rounded p-0.5 hover:bg-gray-300 dark:hover:bg-gray-700" },
            });
            const __VLS_40 = {}.Pencil;
            /** @type {[typeof __VLS_components.Pencil, ]} */ ;
            // @ts-ignore
            const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
                ...{ class: "size-3 text-gray-400" },
            }));
            const __VLS_42 = __VLS_41({
                ...{ class: "size-3 text-gray-400" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_41));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(!group.collapsed))
                            return;
                        __VLS_ctx.handleDelete(s.session_id);
                    } },
                ...{ class: "rounded p-0.5 hover:bg-red-100 dark:hover:bg-red-900/30" },
            });
            const __VLS_44 = {}.Trash2;
            /** @type {[typeof __VLS_components.Trash2, ]} */ ;
            // @ts-ignore
            const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
                ...{ class: "size-3 text-red-400" },
            }));
            const __VLS_46 = __VLS_45({
                ...{ class: "size-3 text-red-400" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_45));
        }
    }
}
if (__VLS_ctx.groupedSessions.length === 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "px-4 py-8 text-center text-xs text-gray-400" },
    });
    (__VLS_ctx.searchQuery ? '没有匹配的会话' : '暂无会话');
}
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['w-64']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['border-r']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-50']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:bg-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['size-7']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:hover:bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['size-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['pb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['left-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['top-1/2']} */ ;
/** @type {__VLS_StyleScopedClasses['size-3.5']} */ ;
/** @type {__VLS_StyleScopedClasses['-translate-y-1/2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['pl-8']} */ ;
/** @type {__VLS_StyleScopedClasses['pr-8']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['right-2']} */ ;
/** @type {__VLS_StyleScopedClasses['top-1/2']} */ ;
/** @type {__VLS_StyleScopedClasses['-translate-y-1/2']} */ ;
/** @type {__VLS_StyleScopedClasses['size-3.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['pb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['px-1']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wider']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['size-3']} */ ;
/** @type {__VLS_StyleScopedClasses['size-3']} */ ;
/** @type {__VLS_StyleScopedClasses['group']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:hover:bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['size-4']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['px-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-0']} */ ;
/** @type {__VLS_StyleScopedClasses['group-hover:opacity-100']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['p-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:hover:bg-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['size-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-blue-400']} */ ;
/** @type {__VLS_StyleScopedClasses['size-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['p-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:hover:bg-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['size-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['size-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['p-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:hover:bg-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['size-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['p-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-red-100']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:hover:bg-red-900/30']} */ ;
/** @type {__VLS_StyleScopedClasses['size-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-400']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-8']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            Plus: Plus,
            Search: Search,
            X: X,
            Pin: Pin,
            PinOff: PinOff,
            Pencil: Pencil,
            Trash2: Trash2,
            MessageSquare: MessageSquare,
            ChevronDown: ChevronDown,
            ChevronRight: ChevronRight,
            Share2: Share2,
            Link2Off: Link2Off,
            formatCustomTime: formatCustomTime,
            route: route,
            groupedSessions: groupedSessions,
            searchQuery: searchQuery,
            activeFilter: activeFilter,
            setFilter: setFilter,
            setSearchQuery: setSearchQuery,
            toggleGroupCollapse: toggleGroupCollapse,
            editingId: editingId,
            editTitle: editTitle,
            handleNewChat: handleNewChat,
            handleSessionClick: handleSessionClick,
            handlePin: handlePin,
            startRename: startRename,
            finishRename: finishRename,
            handleDelete: handleDelete,
            handleToggleShare: handleToggleShare,
            filters: filters,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
