import StageNode from './StageNode.vue';
const { stages, currentStage } = defineProps();
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "space-y-0" },
});
for (const [stage, index] of __VLS_getVForSourceType((stages))) {
    /** @type {[typeof StageNode, ]} */ ;
    // @ts-ignore
    const __VLS_0 = __VLS_asFunctionalComponent(StageNode, new StageNode({
        key: (stage.id),
        stage: (stage),
        isCurrent: (stage.id === currentStage),
        isLast: (index === stages.length - 1),
    }));
    const __VLS_1 = __VLS_0({
        key: (stage.id),
        stage: (stage),
        isCurrent: (stage.id === currentStage),
        isLast: (index === stages.length - 1),
    }, ...__VLS_functionalComponentArgsRest(__VLS_0));
}
/** @type {__VLS_StyleScopedClasses['space-y-0']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            StageNode: StageNode,
        };
    },
    __typeProps: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    __typeProps: {},
});
; /* PartiallyEnd: #4569/main.vue */
