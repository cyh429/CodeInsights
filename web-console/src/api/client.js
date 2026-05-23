import axios from 'axios';
// Axios instance with base URL from env
export const apiClient = axios.create({
    baseURL: import.meta.env?.VITE_API_BASE_URL || ''
});
// Token helpers
function getToken() {
    try {
        return localStorage.getItem('rv_access_token');
    }
    catch {
        return null;
    }
}
// Attach token to each request
apiClient.interceptors.request.use((config) => {
    const token = getToken();
    if (token) {
        if (!config.headers)
            config.headers = {};
        config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
});
// Separate instance for refresh requests to avoid circular interception
const refreshApi = axios.create({ baseURL: apiClient.defaults.baseURL });
// Refresh token workflow
apiClient.interceptors.response.use(undefined, async (error) => {
    const originalRequest = error?.config;
    if (error?.response?.status === 401 &&
        originalRequest &&
        !originalRequest.__isRetry) {
        originalRequest.__isRetry = true;
        const refreshToken = localStorage.getItem('rv_refresh_token');
        if (!refreshToken) {
            return Promise.reject(error);
        }
        try {
            const res = await refreshApi.post('/api/v1/auth/refresh', {
                refresh_token: refreshToken
            });
            const data = res.data || {};
            if (data.access_token) {
                localStorage.setItem('rv_access_token', data.access_token);
                // Update the Authorization header and retry
                originalRequest.headers['Authorization'] = `Bearer ${data.access_token}`;
                return apiClient(originalRequest);
            }
        }
        catch {
            // Fall through to error below
        }
    }
    return Promise.reject(error);
});
// SSE helper using @microsoft/fetch-event-source
import { fetchEventSource } from '@microsoft/fetch-event-source';
export function connectSSE(url, handlers) {
    const controller = new AbortController();
    const token = typeof getToken === 'function' ? getToken() : null;
    fetchEventSource(url, {
        signal: controller.signal,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        onmessage: (ev) => handlers.onMessage(ev),
        onerror: handlers.onError,
        onopen: handlers.onOpen
    });
    return controller;
}
export default apiClient;
