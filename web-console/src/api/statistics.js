import { apiClient } from './client';
const BASE = '/api/v1/statistics';
export async function getSummary(days = 30) {
    const res = await apiClient.get(`${BASE}/summary`, { params: { days } });
    return res.data;
}
export async function getModelStats(days = 30) {
    const res = await apiClient.get(`${BASE}/models`, { params: { days } });
    return res.data;
}
export async function getTrends(days = 30) {
    const res = await apiClient.get(`${BASE}/trends`, { params: { days } });
    return res.data;
}
export async function getSessionStats(days = 30, limit = 20) {
    const res = await apiClient.get(`${BASE}/sessions`, { params: { days, limit } });
    return res.data;
}
