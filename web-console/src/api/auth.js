import { apiClient } from './client';
const USE_MOCK = import.meta.env?.VITE_USE_MOCK === 'true';
export async function registerUser(data) {
    if (USE_MOCK) {
        const m = await import('./mock');
        return m.mockRegisterUser(data);
    }
    const res = await apiClient.post('/api/v1/auth/register', data);
    return res.data;
}
export async function loginUser(data) {
    if (USE_MOCK) {
        const m = await import('./mock');
        return m.mockLoginUser(data);
    }
    const res = await apiClient.post('/api/v1/auth/login', data);
    // Persist tokens if returned
    const payload = res.data;
    if (payload?.access_token) {
        localStorage.setItem('rv_access_token', payload.access_token);
    }
    if (payload?.refresh_token) {
        localStorage.setItem('rv_refresh_token', payload.refresh_token);
    }
    return payload;
}
export async function refreshToken(refreshToken) {
    const res = await apiClient.post('/api/v1/auth/refresh', {
        refresh_token: refreshToken
    });
    return res.data;
}
export async function logoutUser() {
    const res = await apiClient.post('/api/v1/auth/logout');
    localStorage.removeItem('rv_access_token');
    localStorage.removeItem('rv_refresh_token');
    return res.data;
}
