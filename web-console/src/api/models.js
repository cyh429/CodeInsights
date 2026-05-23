import { apiClient } from './client';
const BASE = '/api/v1/models';
export async function listModels() {
    const res = await apiClient.get(BASE);
    return res.data;
}
export async function createModel(payload) {
    const res = await apiClient.post(BASE, payload);
    return res.data;
}
export async function updateModel(modelId, payload) {
    const res = await apiClient.put(`${BASE}/${modelId}`, payload);
    return res.data;
}
export async function deleteModel(modelId) {
    const res = await apiClient.delete(`${BASE}/${modelId}`);
    return res.data;
}
export async function detectContextWindow(payload) {
    const res = await apiClient.post(`${BASE}/detect-context-window`, payload);
    return res.data;
}
