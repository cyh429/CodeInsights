import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import * as chatApi from '@/api/chat';
export const useChatStore = defineStore('chat', () => {
    const sessions = ref([]);
    const currentSession = ref(null);
    const loading = ref(false);
    const isStreaming = ref(false);
    const sortedSessions = computed(() => [...sessions.value].sort((a, b) => {
        if (a.pinned !== b.pinned)
            return a.pinned ? -1 : 1;
        return (b.latest_message_at ?? 0) - (a.latest_message_at ?? 0);
    }));
    async function fetchSessions() {
        loading.value = true;
        try {
            const res = await chatApi.listSessions();
            if (res.code === 0) {
                sessions.value = res.data.sessions;
            }
        }
        finally {
            loading.value = false;
        }
    }
    async function fetchSession(sessionId) {
        loading.value = true;
        try {
            const res = await chatApi.getSession(sessionId);
            if (res.code === 0) {
                currentSession.value = res.data;
            }
            return res;
        }
        finally {
            loading.value = false;
        }
    }
    async function createSession(mode = 'chat') {
        const res = await chatApi.createSession({ mode });
        if (res.code === 0) {
            await fetchSessions();
        }
        return res;
    }
    async function removeSession(sessionId) {
        const res = await chatApi.deleteSession(sessionId);
        if (res.code === 0) {
            sessions.value = sessions.value.filter((s) => s.session_id !== sessionId);
            if (currentSession.value?.session_id === sessionId) {
                currentSession.value = null;
            }
        }
        return res;
    }
    async function pinSession(sessionId, pinned) {
        const res = await chatApi.updatePin(sessionId, pinned);
        if (res.code === 0) {
            sessions.value = sessions.value.map((s) => s.session_id === sessionId ? { ...s, pinned } : s);
        }
        return res;
    }
    async function renameSession(sessionId, title) {
        const res = await chatApi.updateTitle(sessionId, title);
        if (res.code === 0) {
            sessions.value = sessions.value.map((s) => s.session_id === sessionId ? { ...s, title } : s);
            if (currentSession.value?.session_id === sessionId) {
                currentSession.value = { ...currentSession.value, title };
            }
        }
        return res;
    }
    function updateSessionInList(sessionId, patch) {
        sessions.value = sessions.value.map((s) => s.session_id === sessionId ? { ...s, ...patch } : s);
    }
    function $reset() {
        sessions.value = [];
        currentSession.value = null;
        loading.value = false;
        isStreaming.value = false;
    }
    return {
        sessions,
        currentSession,
        loading,
        isStreaming,
        sortedSessions,
        fetchSessions,
        fetchSession,
        createSession,
        removeSession,
        pinSession,
        renameSession,
        updateSessionInList,
        $reset,
    };
});
