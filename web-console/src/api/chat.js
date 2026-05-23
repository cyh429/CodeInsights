import { apiClient, connectSSE } from './client';
import { fetchEventSource } from '@microsoft/fetch-event-source';
const BASE = '/api/v1/sessions';
function getToken() {
    try {
        return localStorage.getItem('rv_access_token');
    }
    catch {
        return null;
    }
}
export async function createSession(payload = {}) {
    const res = await apiClient.put(BASE, payload);
    return res.data;
}
export async function listSessions() {
    const res = await apiClient.get(BASE);
    return res.data;
}
export async function getSession(sessionId) {
    const res = await apiClient.get(`${BASE}/${sessionId}`);
    return res.data;
}
export async function deleteSession(sessionId) {
    const res = await apiClient.delete(`${BASE}/${sessionId}`);
    return res.data;
}
export async function updatePin(sessionId, pinned) {
    const res = await apiClient.patch(`${BASE}/${sessionId}/pin`, { pinned });
    return res.data;
}
export async function updateTitle(sessionId, title) {
    const res = await apiClient.patch(`${BASE}/${sessionId}/title`, { title });
    return res.data;
}
export async function clearUnread(sessionId) {
    const res = await apiClient.post(`${BASE}/${sessionId}/clear_unread_message_count`);
    return res.data;
}
export async function stopChat(sessionId) {
    const res = await apiClient.post(`${BASE}/${sessionId}/stop`);
    return res.data;
}
export async function shareSession(sessionId) {
    const res = await apiClient.post(`${BASE}/${sessionId}/share`);
    return res.data;
}
export async function unshareSession(sessionId) {
    const res = await apiClient.delete(`${BASE}/${sessionId}/share`);
    return res.data;
}
export async function getSharedSession(sessionId) {
    const res = await apiClient.get(`${BASE}/shared/${sessionId}`);
    return res.data;
}
export async function uploadFile(sessionId, file) {
    const form = new FormData();
    form.append('file', file);
    const res = await apiClient.post(`${BASE}/${sessionId}/files`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
}
export async function getSessionFiles(sessionId) {
    const res = await apiClient.get(`${BASE}/${sessionId}/files`);
    return res.data;
}
export function connectChatSSE(sessionId, payload, handlers) {
    const controller = new AbortController();
    const token = getToken();
    const baseURL = apiClient.defaults.baseURL || '';
    const url = `${baseURL}${BASE}/${sessionId}/chat`;
    fetchEventSource(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
        onmessage(ev) {
            try {
                const data = ev.data ? JSON.parse(ev.data) : {};
                handlers.onMessage(ev.event || 'message', data);
            }
            catch {
                handlers.onMessage(ev.event || 'message', { raw: ev.data });
            }
        },
        onerror(err) {
            handlers.onError?.(err);
        },
        async onopen() {
            handlers.onOpen?.();
        },
    });
    return controller;
}
export function connectNotificationsSSE(handlers) {
    return connectSSE(`${BASE}/notifications`, {
        onMessage(ev) {
            try {
                const data = ev.data ? JSON.parse(ev.data) : {};
                handlers.onMessage(ev.event || 'notification', data);
            }
            catch {
                handlers.onMessage(ev.event || 'notification', { raw: ev.data });
            }
        },
        onError: handlers.onError,
    });
}
