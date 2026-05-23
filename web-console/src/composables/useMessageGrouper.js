export function groupEvents(events) {
    const groups = [];
    let currentGroup = null;
    for (const ev of events) {
        const type = ev.type || ev.event;
        const data = ev.data || {};
        if (type === 'message' && data.role === 'user') {
            currentGroup = {
                id: ev.event_id || data.event_id || String(groups.length),
                type: 'user',
                events: [ev],
                content: data.content || '',
                toolCalls: [],
                timestamp: ev.timestamp || data.timestamp || 0,
            };
            groups.push(currentGroup);
            currentGroup = null;
            continue;
        }
        if (type === 'message_chunk') {
            if (!currentGroup || currentGroup.type !== 'assistant') {
                currentGroup = {
                    id: data.event_id || String(groups.length),
                    type: 'assistant',
                    events: [],
                    content: '',
                    toolCalls: [],
                    timestamp: ev.timestamp || data.timestamp || 0,
                };
                groups.push(currentGroup);
            }
            currentGroup.content += data.content || '';
            currentGroup.events.push(ev);
            continue;
        }
        if (type === 'message_chunk_done') {
            if (currentGroup && currentGroup.type === 'assistant') {
                currentGroup.events.push(ev);
            }
            continue;
        }
        if (type === 'tool') {
            if (!currentGroup || currentGroup.type !== 'assistant') {
                currentGroup = {
                    id: data.event_id || String(groups.length),
                    type: 'assistant',
                    events: [],
                    content: '',
                    toolCalls: [],
                    timestamp: ev.timestamp || data.timestamp || 0,
                };
                groups.push(currentGroup);
            }
            const existingCall = currentGroup.toolCalls.find((tc) => tc.toolCallId === data.tool_call_id);
            if (existingCall) {
                existingCall.status = data.status || existingCall.status;
                if (data.content) {
                    existingCall.content = data.content;
                }
            }
            else {
                currentGroup.toolCalls.push({
                    toolCallId: data.tool_call_id || '',
                    name: data.name || '',
                    args: data.args || {},
                    status: data.status || 'calling',
                    content: data.content || '',
                });
            }
            currentGroup.events.push(ev);
            continue;
        }
        if (type === 'error') {
            groups.push({
                id: data.event_id || String(groups.length),
                type: 'error',
                events: [ev],
                content: data.error || 'Unknown error',
                toolCalls: [],
                timestamp: ev.timestamp || data.timestamp || 0,
            });
            currentGroup = null;
            continue;
        }
        if (type === 'done') {
            if (currentGroup) {
                currentGroup.events.push(ev);
            }
            currentGroup = null;
            continue;
        }
    }
    return groups;
}
