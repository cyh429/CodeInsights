import { ref } from 'vue';
const onSessionTitleUpdate = ref(null);
export function useSessionListUpdate() {
    return {
        setOnSessionTitleUpdate: (fn) => {
            onSessionTitleUpdate.value = fn;
        },
        updateSessionTitle: (sessionId, title) => {
            onSessionTitleUpdate.value?.(sessionId, title);
        },
    };
}
