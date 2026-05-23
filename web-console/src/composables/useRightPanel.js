import { ref } from 'vue';
const panelType = ref(null);
const panelData = ref({});
export function useRightPanel() {
    function openPanel(type, data = {}) {
        panelType.value = type;
        panelData.value = data;
    }
    function closePanel() {
        panelType.value = null;
        panelData.value = {};
    }
    function togglePanel(type, data = {}) {
        if (panelType.value === type) {
            closePanel();
        }
        else {
            openPanel(type, data);
        }
    }
    return {
        panelType,
        panelData,
        openPanel,
        closePanel,
        togglePanel,
    };
}
