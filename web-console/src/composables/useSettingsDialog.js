import { ref } from 'vue';
const isOpen = ref(false);
const activeTab = ref('general');
export function useSettingsDialog() {
    function open(tab) {
        if (tab) {
            activeTab.value = tab;
        }
        isOpen.value = true;
    }
    function close() {
        isOpen.value = false;
    }
    return {
        isOpen,
        activeTab,
        open,
        close,
    };
}
