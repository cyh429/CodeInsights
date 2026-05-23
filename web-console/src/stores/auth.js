import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { loginUser, registerUser, refreshToken, logoutUser } from '../api/auth';
function decodeJwtPayload(token) {
    try {
        const parts = token.split('.');
        if (parts.length < 2)
            return null;
        const payload = parts[1];
        const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
        const json = decodeURIComponent(atob(base64)
            .split('')
            .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join(''));
        return JSON.parse(json);
    }
    catch {
        return null;
    }
}
export const useAuthStore = defineStore('auth', () => {
    const user = ref(null);
    const isLoading = ref(false);
    const isAuthenticated = computed(() => !!user.value);
    function loadFromStorage() {
        const token = localStorage.getItem('rv_access_token');
        if (token) {
            const payload = decodeJwtPayload(token);
            if (payload) {
                user.value = {
                    id: payload.sub ?? '',
                    username: payload.username ?? payload.name ?? '',
                    email: payload.email ?? '',
                    role: payload.role ?? 'viewer'
                };
            }
        }
    }
    async function login(email, password) {
        isLoading.value = true;
        try {
            const data = await loginUser({ email, password });
            const token = localStorage.getItem('rv_access_token');
            if (token) {
                const payload = decodeJwtPayload(token);
                if (payload) {
                    user.value = {
                        id: payload.sub ?? '',
                        username: payload.username ?? payload.name ?? '',
                        email: payload.email ?? email,
                        role: payload.role ?? 'viewer'
                    };
                }
            }
            return data;
        }
        finally {
            isLoading.value = false;
        }
    }
    async function register(username, email, password) {
        isLoading.value = true;
        try {
            const data = await registerUser({ username, email, password });
            // Attempt to set user from stored token if available
            const token = localStorage.getItem('rv_access_token');
            if (token) {
                const payload = decodeJwtPayload(token);
                if (payload) {
                    user.value = {
                        id: payload.sub ?? '',
                        username: payload.username ?? payload.name ?? '',
                        email: payload.email ?? email,
                        role: payload.role ?? 'viewer'
                    };
                }
            }
            return data;
        }
        finally {
            isLoading.value = false;
        }
    }
    async function logout() {
        await logoutUser();
        user.value = null;
    }
    async function refreshAuth() {
        const refresh = localStorage.getItem('rv_refresh_token');
        if (!refresh)
            return false;
        try {
            const data = await refreshToken(refresh);
            if (data?.access_token) {
                localStorage.setItem('rv_access_token', data.access_token);
                const payload = decodeJwtPayload(data.access_token);
                if (payload) {
                    user.value = {
                        id: payload.sub ?? '',
                        username: payload.username ?? payload.name ?? '',
                        email: payload.email ?? '',
                        role: payload.role ?? 'viewer'
                    };
                }
                return true;
            }
        }
        catch {
            // ignore
        }
        return false;
    }
    // Init
    loadFromStorage();
    return { user, isAuthenticated, isLoading, login, register, logout, refreshAuth };
});
