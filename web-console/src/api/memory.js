import { apiClient } from './client';
const BASE = '/api/v1/memory';
export async function getMemory() {
    const res = await apiClient.get(BASE);
    return res.data;
}
export async function updateMemory(content) {
    const res = await apiClient.put(BASE, { content });
    return res.data;
}
