import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { getCase, startPipeline as apiStartPipeline, submitReview as apiSubmitReview } from '@/api/cases';
// Map backend CaseStatus to a 5-stage pipeline view: explore, plan, develop, review, test
const stageOrder = ['explore', 'plan', 'develop', 'review', 'test'];
const STATUS_ORDER = [
    'created', 'exploring', 'pending_explore_review',
    'planning', 'pending_plan_review',
    'developing', 'reviewing', 'pending_code_review',
    'testing', 'pending_test_review',
    'completed', 'abandoned',
];
function statusIndex(status) {
    const idx = STATUS_ORDER.indexOf(status);
    return idx >= 0 ? idx : 0;
}
// Maps 5 pipeline stages → [startIndex, endIndex] in STATUS_ORDER
const stageRanges = {
    explore: [1, 2],
    plan: [3, 4],
    develop: [5, 5],
    review: [6, 7],
    test: [8, 9],
};
function stageStatusFor(currentStatus, stageId) {
    if (!currentStatus)
        return 'pending';
    if (currentStatus === 'abandoned')
        return 'failed';
    const idx = statusIndex(currentStatus);
    const [start, end] = stageRanges[stageId];
    if (idx < start)
        return 'pending';
    if (idx >= start && idx <= end) {
        if (currentStatus.startsWith('pending_'))
            return 'waiting_review';
        return 'running';
    }
    return 'completed';
}
export const useCaseStore = defineStore('case', () => {
    const currentCase = ref(null);
    const events = ref([]);
    const isLoading = ref(false);
    const error = ref(null);
    // Derived pipeline stages from current case status
    const stages = computed(() => {
        return stageOrder.map((id) => ({
            id,
            label: id.charAt(0).toUpperCase() + id.slice(1),
            status: stageStatusFor(currentCase.value?.status, id),
        }));
    });
    const currentStage = computed(() => {
        const s = currentCase.value?.status;
        if (!s)
            return null;
        const idx = statusIndex(s);
        for (const stage of stageOrder) {
            const [start, end] = stageRanges[stage];
            if (idx >= start && idx <= end)
                return stage;
        }
        if (s === 'completed' || s === 'abandoned')
            return 'test';
        return null;
    });
    const isWaitingReview = computed(() => {
        const s = currentCase.value?.status;
        return !!s && s.startsWith('pending_');
    });
    // Actions
    async function loadCase(caseId) {
        isLoading.value = true;
        error.value = null;
        try {
            const c = await getCase(caseId);
            currentCase.value = c;
        }
        catch (e) {
            error.value = e?.message ?? 'Failed to load case';
        }
        finally {
            isLoading.value = false;
        }
    }
    async function startPipeline(caseId) {
        isLoading.value = true;
        error.value = null;
        try {
            const updated = await apiStartPipeline(caseId);
            currentCase.value = updated;
            return updated;
        }
        catch (e) {
            error.value = e?.message ?? 'Failed to start pipeline';
            throw e;
        }
        finally {
            isLoading.value = false;
        }
    }
    async function submitReview(caseId, decision) {
        isLoading.value = true;
        error.value = null;
        try {
            const updated = await apiSubmitReview(caseId, decision);
            currentCase.value = updated;
            return updated;
        }
        catch (e) {
            error.value = e?.message ?? 'Failed to submit review';
            throw e;
        }
        finally {
            isLoading.value = false;
        }
    }
    function addEvent(event) {
        events.value.push(event);
    }
    function clearEvents() {
        events.value = [];
    }
    function reset() {
        currentCase.value = null;
        events.value = [];
        error.value = null;
    }
    return {
        currentCase,
        events,
        isLoading,
        error,
        stages,
        currentStage,
        isWaitingReview,
        loadCase,
        startPipeline,
        submitReview,
        addEvent,
        clearEvents,
        reset,
    };
});
