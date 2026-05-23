const MOCK_DELAY = 200;
let mockCases = [
    {
        id: '1',
        title: 'Fix RISC-V timer interrupt',
        status: 'exploring',
        target_repo: 'riscv/linux',
        owner_id: 'mock@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        cost: { total_input_tokens: 0, total_output_tokens: 0, estimated_cost_usd: 0 },
    },
    {
        id: '2',
        title: 'Add SBI extension support',
        status: 'planning',
        target_repo: 'riscv/opensbi',
        owner_id: 'mock@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        cost: { total_input_tokens: 0, total_output_tokens: 0, estimated_cost_usd: 0 },
    },
    {
        id: '3',
        title: 'QEMU virtio driver fix',
        status: 'completed',
        target_repo: 'qemu/qemu',
        owner_id: 'mock@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        cost: { total_input_tokens: 0, total_output_tokens: 0, estimated_cost_usd: 0 },
    },
];
function delay(ms, value) {
    return new Promise(resolve => setTimeout(() => resolve(value), ms));
}
export function setupMockApi() {
    return {
        listCases: async (params) => {
            const page = params?.page ?? 1;
            const perPage = params?.perPage ?? 6;
            let items = mockCases;
            if (params?.status)
                items = items.filter(c => c.status === params.status);
            if (params?.target_repo)
                items = items.filter(c => c.target_repo.includes(params.target_repo));
            if (params?.sort === 'created_desc')
                items = items.slice().sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
            const start = (page - 1) * perPage;
            return {
                items: items.slice(start, start + perPage),
                total: items.length,
                page,
                per_page: perPage
            };
        },
        createCase: async (data) => {
            const c = {
                id: 'mock-' + Date.now(),
                title: data.title,
                status: 'created',
                target_repo: data.target_repo,
                owner_id: 'mock@example.com',
                input_context: data.input_context,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                cost: { total_input_tokens: 0, total_output_tokens: 0, estimated_cost_usd: 0 },
            };
            mockCases.push(c);
            return c;
        },
        getCase: async (id) => {
            const found = mockCases.find(c => c.id === id);
            if (!found)
                throw new Error('Not Found');
            return found;
        },
        // Start pipeline mock: move status to 'exploring'
        startPipeline: async (caseId) => {
            const c = mockCases.find(x => x.id === caseId);
            if (!c)
                throw new Error('Not Found');
            c.status = 'exploring';
            return { ...c };
        },
        deleteCase: async (caseId) => {
            const idx = mockCases.findIndex(x => x.id === caseId);
            if (idx === -1)
                throw new Error('Not Found');
            mockCases.splice(idx, 1);
            return { detail: 'Deleted' };
        },
        // Submit a review mock: advance status or abandon
        submitReview: async (caseId, decision) => {
            const c = mockCases.find(x => x.id === caseId);
            if (!c)
                throw new Error('Not Found');
            if (decision.action === 'approve') {
                // advance to next logical phase based on current status
                const transitions = {
                    'created': 'exploring',
                    'exploring': 'pending_explore_review',
                    'pending_explore_review': 'planning',
                    'planning': 'pending_plan_review',
                    'pending_plan_review': 'developing',
                    'developing': 'reviewing',
                    'reviewing': 'pending_code_review',
                    'pending_code_review': 'testing',
                    'testing': 'pending_test_review',
                    'pending_test_review': 'completed',
                    'completed': 'completed',
                    'abandoned': 'abandoned',
                };
                c.status = (transitions[c.status] ?? c.status);
            }
            else if (decision.action === 'abandon') {
                c.status = 'abandoned';
            }
            return { ...c };
        },
    };
}
export async function mockLoginUser(data) {
    await delay(MOCK_DELAY, null);
    if (data.email.includes('@')) {
        const payload = {
            access_token: 'mock_access_token',
            refresh_token: 'mock_refresh_token',
            token_type: 'bearer'
        };
        localStorage.setItem('rv_access_token', payload.access_token);
        localStorage.setItem('rv_refresh_token', payload.refresh_token);
        return payload;
    }
    throw new Error('Invalid credentials');
}
export async function mockSSEStream(caseId, handlers) {
    const c = mockCases.find(x => x.id === caseId);
    if (!c) {
        handlers.onError?.(new Error('Case not found'));
        return () => { };
    }
    const events = [];
    let seq = 1;
    const push = (event_type, data) => {
        events.push({ event_type, data });
    };
    if (c.status === 'exploring' || c.status === 'pending_explore_review') {
        push('stage_change', { stage: 'explore', status: 'started' });
        push('agent_output', { type: 'thinking', content: 'Scanning target repository for contribution opportunities...' });
        push('agent_output', { type: 'tool_call', tool_name: 'Grep', args: { pattern: 'TODO|FIXME', path: 'arch/riscv' } });
        push('agent_output', { type: 'tool_result', tool_name: 'Grep', result: ['arch/riscv/kernel/time.c: TODO: optimize timer init', 'arch/riscv/mm/init.c: FIXME: memory alignment'] });
        push('agent_output', { type: 'thinking', content: 'Found 2 potential targets. Evaluating feasibility...' });
        push('stage_change', { stage: 'explore', status: 'completed' });
        push('review_request', { stage: 'explore' });
    }
    if (c.status === 'planning' || c.status === 'pending_plan_review') {
        push('stage_change', { stage: 'plan', status: 'started' });
        push('agent_output', { type: 'thinking', content: 'Designing development and test plan...' });
        push('stage_change', { stage: 'plan', status: 'completed' });
        push('review_request', { stage: 'plan' });
    }
    if (c.status === 'developing' || c.status === 'reviewing' || c.status === 'pending_code_review') {
        push('stage_change', { stage: 'develop', status: 'started' });
        push('agent_output', { type: 'thinking', content: 'Generating patch for timer optimization...' });
        push('agent_output', { type: 'tool_call', tool_name: 'Edit', args: { file: 'arch/riscv/kernel/time.c', old_string: '// TODO', new_string: '/* Optimized timer init */' } });
        push('agent_output', { type: 'tool_result', tool_name: 'Edit', result: 'Successfully edited arch/riscv/kernel/time.c' });
        push('stage_change', { stage: 'develop', status: 'completed' });
        push('stage_change', { stage: 'review', status: 'started' });
        push('agent_output', { type: 'thinking', content: 'Reviewing patch for correctness and style...' });
        push('stage_change', { stage: 'review', status: 'completed' });
        push('review_request', { stage: 'code' });
    }
    if (c.status === 'testing' || c.status === 'pending_test_review') {
        push('stage_change', { stage: 'test', status: 'started' });
        push('agent_output', { type: 'thinking', content: 'Running compilation tests...' });
        push('agent_output', { type: 'tool_call', tool_name: 'Bash', args: { command: 'make ARCH=riscv defconfig && make -j$(nproc)' } });
        push('agent_output', { type: 'tool_result', tool_name: 'Bash', result: 'Build succeeded. vmlinux generated.' });
        push('stage_change', { stage: 'test', status: 'completed' });
        push('review_request', { stage: 'test' });
    }
    if (c.status === 'completed') {
        push('completed', { message: 'Pipeline finished successfully' });
    }
    handlers.onOpen?.();
    let i = 0;
    const interval = setInterval(() => {
        if (i >= events.length) {
            clearInterval(interval);
            return;
        }
        const evt = events[i++];
        const payload = {
            seq: seq++,
            case_id: caseId,
            event_type: evt.event_type,
            data: evt.data,
            timestamp: new Date().toISOString(),
        };
        handlers.onMessage({ data: JSON.stringify(payload) });
    }, 800);
    return () => clearInterval(interval);
}
export async function mockRegisterUser(data) {
    await delay(MOCK_DELAY, null);
    const payload = {
        access_token: 'mock_access_token',
        refresh_token: 'mock_refresh_token',
        token_type: 'bearer'
    };
    localStorage.setItem('rv_access_token', payload.access_token);
    localStorage.setItem('rv_refresh_token', payload.refresh_token);
    return payload;
}
