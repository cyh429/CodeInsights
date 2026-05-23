import { onUnmounted, ref } from 'vue';
import { connectNotificationsSSE } from '@/api/chat';
const createdCallbacks = ref(new Map());
const updatedCallbacks = ref(new Map());
let controller = null;
let reconnectTimer = null;
let nextId = 0;
let active = false;
function handleEvent(event, data) {
    if (event === 'session_created') {
        createdCallbacks.value.forEach((cb) => cb(data));
    }
    else if (event === 'session_updated') {
        updatedCallbacks.value.forEach((cb) => cb(data));
    }
}
function connect() {
    if (controller)
        return;
    active = true;
    controller = connectNotificationsSSE({
        onMessage: handleEvent,
        onError: () => {
            controller = null;
            if (active) {
                reconnectTimer = setTimeout(connect, 5000);
            }
        },
    });
}
function disconnect() {
    active = false;
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    if (controller) {
        controller.abort();
        controller = null;
    }
}
export function useSessionNotifications() {
    const ids = [];
    const onSessionCreated = (cb) => {
        const id = nextId++;
        createdCallbacks.value.set(id, cb);
        ids.push(id);
        if (!active)
            connect();
    };
    const onSessionUpdated = (cb) => {
        const id = nextId++;
        updatedCallbacks.value.set(id, cb);
        ids.push(id);
        if (!active)
            connect();
    };
    onUnmounted(() => {
        for (const id of ids) {
            createdCallbacks.value.delete(id);
            updatedCallbacks.value.delete(id);
        }
        if (createdCallbacks.value.size + updatedCallbacks.value.size === 0) {
            disconnect();
        }
    });
    return { onSessionCreated, onSessionUpdated };
}
