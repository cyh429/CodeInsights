import { ref, computed } from 'vue';
import { getSessionFiles, uploadFile } from '@/api/chat';
const files = ref([]);
const selectedFileId = ref(null);
const mode = ref('list');
const loading = ref(false);
export function useFilePanel() {
    const selectedFile = computed(() => files.value.find((f) => f.id === selectedFileId.value) ?? null);
    async function loadFiles(sessionId) {
        loading.value = true;
        try {
            const res = await getSessionFiles(sessionId);
            if (res.code === 0) {
                files.value = res.data.files;
            }
        }
        finally {
            loading.value = false;
        }
    }
    async function upload(sessionId, file) {
        const res = await uploadFile(sessionId, file);
        if (res.code === 0) {
            await loadFiles(sessionId);
        }
        return res;
    }
    function selectFile(fileId) {
        selectedFileId.value = fileId;
        mode.value = fileId ? 'single' : 'list';
    }
    function clearFiles() {
        files.value = [];
        selectedFileId.value = null;
        mode.value = 'list';
    }
    return {
        files,
        selectedFileId,
        selectedFile,
        mode,
        loading,
        loadFiles,
        upload,
        selectFile,
        clearFiles,
    };
}
