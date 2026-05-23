import { computed } from 'vue';
// Simple static stage definitions for visualization
const STAGE_DEFS = [
    { id: 'explore', label: 'Explore' },
    { id: 'plan', label: 'Plan' },
    { id: 'develop', label: 'Develop' },
    { id: 'review', label: 'Review' },
    { id: 'test', label: 'Test' },
];
const STATUS_ORDER = [
    'created', 'exploring', 'pending_explore_review',
    'planning', 'pending_plan_review',
    'developing', 'reviewing', 'pending_code_review',
    'testing', 'pending_test_review',
    'completed', 'abandoned',
];
const STAGE_RANGES = {
    explore: [1, 2],
    plan: [3, 4],
    develop: [5, 5],
    review: [6, 7],
    test: [8, 9],
};
function statusIndex(status) {
    const idx = STATUS_ORDER.indexOf(status);
    return idx >= 0 ? idx : 0;
}
function deriveStageStatus(caseStatus, stageId) {
    if (caseStatus === 'abandoned')
        return 'failed';
    const idx = statusIndex(caseStatus);
    const range = STAGE_RANGES[stageId];
    if (!range)
        return 'pending';
    const [start, end] = range;
    if (idx < start)
        return 'pending';
    if (idx >= start && idx <= end) {
        return caseStatus.startsWith('pending_') ? 'waiting_review' : 'running';
    }
    return 'completed';
}
export function usePipeline(caseItem) {
    const stages = computed(() => {
        const status = caseItem.value?.status;
        return STAGE_DEFS.map(({ id, label }) => ({
            id,
            label,
            status: status ? deriveStageStatus(status, id) : 'pending',
        }));
    });
    const currentStage = computed(() => {
        const s = caseItem.value?.status;
        if (!s)
            return null;
        const idx = statusIndex(s);
        for (const [stageId, [start, end]] of Object.entries(STAGE_RANGES)) {
            if (idx >= start && idx <= end)
                return stageId;
        }
        if (s === 'completed' || s === 'abandoned')
            return 'test';
        return null;
    });
    const isWaitingReview = computed(() => {
        const s = caseItem.value?.status;
        return !!s && s.startsWith('pending_');
    });
    const reviewIteration = computed(() => {
        return caseItem.value?.review_iterations ?? 0;
    });
    return { stages, currentStage, isWaitingReview, reviewIteration };
}
