import { onMounted, computed, toRef } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, Loader2, XCircle } from 'lucide-vue-next';
import CaseStatusBadge from '@/components/CaseStatusBadge.vue';
import PipelineView from '@/components/pipeline/PipelineView.vue';
import ReviewPanel from '@/components/pipeline/ReviewPanel.vue';
import ContributionCard from '@/components/pipeline/ContributionCard.vue';
import ExecutionPlanView from '@/components/pipeline/ExecutionPlanView.vue';
import DevelopmentResultCard from '@/components/pipeline/DevelopmentResultCard.vue';
import ReviewVerdictCard from '@/components/pipeline/ReviewVerdictCard.vue';
import IterationBadge from '@/components/pipeline/IterationBadge.vue';
import AgentEventLog from '@/components/AgentEventLog.vue';
import { useCaseStore } from '@/stores/case';
import { useCaseEvents } from '@/composables/useCaseEvents';
const route = useRoute();
const router = useRouter();
const caseStore = useCaseStore();
const caseId = computed(() => route.params.id);
const caseEvents = useCaseEvents(caseId);
const currentCaseRef = toRef(caseStore, 'currentCase');
function goBack() {
    router.push('/cases');
}
async function handleStart() {
    await caseStore.startPipeline(caseId.value);
    caseEvents.connect();
}
async function handleReview(decision) {
    await caseStore.submitReview(caseId.value, decision);
}
async function retryLoad() {
    await caseStore.loadCase(caseId.value);
}
onMounted(async () => {
    await caseStore.loadCase(caseId.value);
    if (caseStore.currentCase?.status !== 'created') {
        caseEvents.connect();
    }
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex flex-col h-full" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-center gap-3 px-6 py-4 border-b border-gray-200 bg-white" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.goBack) },
    ...{ class: "text-gray-500 hover:text-gray-700" },
    'aria-label': "Back",
});
const __VLS_0 = {}.ArrowLeft;
/** @type {[typeof __VLS_components.ArrowLeft, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ class: "w-5 h-5" },
}));
const __VLS_2 = __VLS_1({
    ...{ class: "w-5 h-5" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex-1 min-w-0" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({
    ...{ class: "text-lg font-semibold text-gray-900 truncate" },
});
(__VLS_ctx.caseStore.currentCase?.title || '');
if (__VLS_ctx.caseStore.currentCase?.target_repo) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-sm text-gray-500 truncate" },
    });
    (__VLS_ctx.caseStore.currentCase.target_repo);
}
if (__VLS_ctx.caseStore.currentCase) {
    /** @type {[typeof CaseStatusBadge, ]} */ ;
    // @ts-ignore
    const __VLS_4 = __VLS_asFunctionalComponent(CaseStatusBadge, new CaseStatusBadge({
        status: (__VLS_ctx.caseStore.currentCase.status),
    }));
    const __VLS_5 = __VLS_4({
        status: (__VLS_ctx.caseStore.currentCase.status),
    }, ...__VLS_functionalComponentArgsRest(__VLS_4));
}
if (__VLS_ctx.caseStore.currentCase?.status === 'created') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.handleStart) },
        disabled: (__VLS_ctx.caseStore.isLoading),
        ...{ class: "px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50" },
    });
}
if (__VLS_ctx.caseStore.isLoading && !__VLS_ctx.caseStore.currentCase) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex-1 flex items-center justify-center" },
    });
    const __VLS_7 = {}.Loader2;
    /** @type {[typeof __VLS_components.Loader2, ]} */ ;
    // @ts-ignore
    const __VLS_8 = __VLS_asFunctionalComponent(__VLS_7, new __VLS_7({
        ...{ class: "w-8 h-8 text-blue-500 animate-spin" },
    }));
    const __VLS_9 = __VLS_8({
        ...{ class: "w-8 h-8 text-blue-500 animate-spin" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_8));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "ml-3 text-gray-500" },
    });
}
else if (__VLS_ctx.caseStore.error) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex-1 flex items-center justify-center" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "text-center" },
    });
    const __VLS_11 = {}.XCircle;
    /** @type {[typeof __VLS_components.XCircle, ]} */ ;
    // @ts-ignore
    const __VLS_12 = __VLS_asFunctionalComponent(__VLS_11, new __VLS_11({
        ...{ class: "w-12 h-12 text-red-400 mx-auto mb-3" },
    }));
    const __VLS_13 = __VLS_12({
        ...{ class: "w-12 h-12 text-red-400 mx-auto mb-3" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_12));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-red-600 font-medium" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-sm text-gray-500 mt-1" },
    });
    (__VLS_ctx.caseStore.error);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.retryLoad) },
        ...{ class: "mt-4 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700" },
    });
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex flex-1 overflow-hidden flex-col md:flex-row" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.aside, __VLS_intrinsicElements.aside)({
        ...{ class: "w-full md:w-72 shrink-0 border-r border-gray-200 bg-gray-50 overflow-y-auto p-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({
        ...{ class: "text-sm font-semibold text-gray-700 mb-3" },
    });
    if (__VLS_ctx.caseStore.stages.length) {
        /** @type {[typeof PipelineView, ]} */ ;
        // @ts-ignore
        const __VLS_15 = __VLS_asFunctionalComponent(PipelineView, new PipelineView({
            stages: (__VLS_ctx.caseStore.stages),
            currentStage: (__VLS_ctx.caseStore.currentStage),
        }));
        const __VLS_16 = __VLS_15({
            stages: (__VLS_ctx.caseStore.stages),
            currentStage: (__VLS_ctx.caseStore.currentStage),
        }, ...__VLS_functionalComponentArgsRest(__VLS_15));
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "mt-4 flex items-center gap-2 text-xs" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span)({
        ...{ class: "w-2 h-2 rounded-full" },
        ...{ class: (__VLS_ctx.caseEvents.isConnected.value ? 'bg-green-500' : 'bg-gray-300') },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "text-gray-500" },
    });
    (__VLS_ctx.caseEvents.isConnected.value ? 'Live' : 'Disconnected');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.main, __VLS_intrinsicElements.main)({
        ...{ class: "flex-1 overflow-y-auto p-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({
        ...{ class: "text-sm font-semibold text-gray-700 mb-3" },
    });
    if (__VLS_ctx.caseEvents.events.value.length === 0) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "text-sm text-gray-400" },
        });
    }
    else {
        /** @type {[typeof AgentEventLog, ]} */ ;
        // @ts-ignore
        const __VLS_18 = __VLS_asFunctionalComponent(AgentEventLog, new AgentEventLog({
            events: (__VLS_ctx.caseEvents.events.value),
        }));
        const __VLS_19 = __VLS_18({
            events: (__VLS_ctx.caseEvents.events.value),
        }, ...__VLS_functionalComponentArgsRest(__VLS_18));
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.aside, __VLS_intrinsicElements.aside)({
        ...{ class: "w-full md:w-80 shrink-0 border-l border-gray-200 bg-gray-50 overflow-y-auto p-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({
        ...{ class: "text-sm font-semibold text-gray-700 mb-3" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "space-y-3 text-sm" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "text-gray-500" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "ml-2 font-medium" },
    });
    (__VLS_ctx.caseStore.currentCase?.target_repo);
    if (__VLS_ctx.caseStore.currentCase?.contribution_type) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "text-gray-500" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "ml-2" },
        });
        (__VLS_ctx.caseStore.currentCase.contribution_type);
    }
    if (__VLS_ctx.caseStore.currentCase?.cost?.estimated_cost_usd != null) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "text-gray-500" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "ml-2" },
        });
        (__VLS_ctx.caseStore.currentCase.cost.estimated_cost_usd.toFixed(2));
    }
    if (__VLS_ctx.caseStore.currentCase?.created_at) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "text-gray-500" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "ml-2" },
        });
        (new Date(__VLS_ctx.caseStore.currentCase.created_at).toLocaleString());
    }
    if (__VLS_ctx.caseStore.currentCase?.exploration_result) {
        /** @type {[typeof ContributionCard, ]} */ ;
        // @ts-ignore
        const __VLS_21 = __VLS_asFunctionalComponent(ContributionCard, new ContributionCard({
            result: (__VLS_ctx.caseStore.currentCase.exploration_result),
            ...{ class: "mt-6" },
        }));
        const __VLS_22 = __VLS_21({
            result: (__VLS_ctx.caseStore.currentCase.exploration_result),
            ...{ class: "mt-6" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_21));
    }
    if (__VLS_ctx.caseStore.currentCase?.execution_plan) {
        /** @type {[typeof ExecutionPlanView, ]} */ ;
        // @ts-ignore
        const __VLS_24 = __VLS_asFunctionalComponent(ExecutionPlanView, new ExecutionPlanView({
            plan: (__VLS_ctx.caseStore.currentCase.execution_plan),
            ...{ class: "mt-4" },
        }));
        const __VLS_25 = __VLS_24({
            plan: (__VLS_ctx.caseStore.currentCase.execution_plan),
            ...{ class: "mt-4" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_24));
    }
    if (__VLS_ctx.caseStore.currentCase?.development_result) {
        /** @type {[typeof DevelopmentResultCard, ]} */ ;
        // @ts-ignore
        const __VLS_27 = __VLS_asFunctionalComponent(DevelopmentResultCard, new DevelopmentResultCard({
            result: (__VLS_ctx.caseStore.currentCase.development_result),
            ...{ class: "mt-4" },
        }));
        const __VLS_28 = __VLS_27({
            result: (__VLS_ctx.caseStore.currentCase.development_result),
            ...{ class: "mt-4" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_27));
    }
    if (__VLS_ctx.caseStore.currentCase?.review_verdict) {
        /** @type {[typeof ReviewVerdictCard, ]} */ ;
        // @ts-ignore
        const __VLS_30 = __VLS_asFunctionalComponent(ReviewVerdictCard, new ReviewVerdictCard({
            verdict: (__VLS_ctx.caseStore.currentCase.review_verdict),
            ...{ class: "mt-4" },
        }));
        const __VLS_31 = __VLS_30({
            verdict: (__VLS_ctx.caseStore.currentCase.review_verdict),
            ...{ class: "mt-4" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_30));
    }
    if (__VLS_ctx.caseStore.currentCase?.review_iterations) {
        /** @type {[typeof IterationBadge, ]} */ ;
        // @ts-ignore
        const __VLS_33 = __VLS_asFunctionalComponent(IterationBadge, new IterationBadge({
            current: (__VLS_ctx.caseStore.currentCase.review_iterations),
            max: (3),
            ...{ class: "mt-3" },
        }));
        const __VLS_34 = __VLS_33({
            current: (__VLS_ctx.caseStore.currentCase.review_iterations),
            max: (3),
            ...{ class: "mt-3" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_33));
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "mt-6" },
    });
    /** @type {[typeof ReviewPanel, ]} */ ;
    // @ts-ignore
    const __VLS_36 = __VLS_asFunctionalComponent(ReviewPanel, new ReviewPanel({
        ...{ 'onReview': {} },
        caseId: (__VLS_ctx.caseId),
        currentStage: (__VLS_ctx.caseStore.currentStage ?? ''),
        isWaitingReview: (__VLS_ctx.caseStore.isWaitingReview),
    }));
    const __VLS_37 = __VLS_36({
        ...{ 'onReview': {} },
        caseId: (__VLS_ctx.caseId),
        currentStage: (__VLS_ctx.caseStore.currentStage ?? ''),
        isWaitingReview: (__VLS_ctx.caseStore.isWaitingReview),
    }, ...__VLS_functionalComponentArgsRest(__VLS_36));
    let __VLS_39;
    let __VLS_40;
    let __VLS_41;
    const __VLS_42 = {
        onReview: (__VLS_ctx.handleReview)
    };
    var __VLS_38;
}
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['px-6']} */ ;
/** @type {__VLS_StyleScopedClasses['py-4']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['w-5']} */ ;
/** @type {__VLS_StyleScopedClasses['h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-blue-600']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-blue-700']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['w-8']} */ ;
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['text-blue-500']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-spin']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['w-12']} */ ;
/** @type {__VLS_StyleScopedClasses['h-12']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-600']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-blue-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-blue-700']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['md:flex-row']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['md:w-72']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['border-r']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-50']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['w-2']} */ ;
/** @type {__VLS_StyleScopedClasses['h-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['md:w-80']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['border-l']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-50']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-6']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-6']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            ArrowLeft: ArrowLeft,
            Loader2: Loader2,
            XCircle: XCircle,
            CaseStatusBadge: CaseStatusBadge,
            PipelineView: PipelineView,
            ReviewPanel: ReviewPanel,
            ContributionCard: ContributionCard,
            ExecutionPlanView: ExecutionPlanView,
            DevelopmentResultCard: DevelopmentResultCard,
            ReviewVerdictCard: ReviewVerdictCard,
            IterationBadge: IterationBadge,
            AgentEventLog: AgentEventLog,
            caseStore: caseStore,
            caseId: caseId,
            caseEvents: caseEvents,
            goBack: goBack,
            handleStart: handleStart,
            handleReview: handleReview,
            retryLoad: retryLoad,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
