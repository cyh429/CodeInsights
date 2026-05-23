import { computed, ref, toValue } from 'vue';
function isToday(ts) {
    if (!ts)
        return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(ts * 1000);
    d.setHours(0, 0, 0, 0);
    return d.getTime() === today.getTime();
}
function isYesterday(ts) {
    if (!ts)
        return false;
    const y = new Date();
    y.setHours(0, 0, 0, 0);
    y.setDate(y.getDate() - 1);
    const d = new Date(ts * 1000);
    d.setHours(0, 0, 0, 0);
    return d.getTime() === y.getTime();
}
function isWithinDays(ts, days) {
    if (!ts)
        return false;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const d = new Date(ts * 1000);
    d.setHours(0, 0, 0, 0);
    const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
    return diff > 0 && diff <= days;
}
export function useSessionGrouping(sessions) {
    const activeFilter = ref('all');
    const collapsedGroups = ref(new Set());
    const searchQuery = ref('');
    const filteredSessions = computed(() => {
        let result = toValue(sessions) ?? [];
        if (searchQuery.value.trim()) {
            const q = searchQuery.value.toLowerCase();
            result = result.filter((s) => s.title?.toLowerCase().includes(q) ||
                s.latest_message?.toLowerCase().includes(q));
        }
        switch (activeFilter.value) {
            case 'pinned':
                return result.filter((s) => s.pinned);
            case 'running':
                return result.filter((s) => s.status === 'running' || s.status === 'pending');
            case 'shared':
                return result.filter((s) => s.is_shared);
            default:
                return result;
        }
    });
    const groupedSessions = computed(() => {
        const items = filteredSessions.value;
        const pinned = [];
        const today = [];
        const yesterday = [];
        const last7 = [];
        const last30 = [];
        const older = [];
        for (const s of items) {
            if (s.pinned)
                pinned.push(s);
            else if (isToday(s.latest_message_at))
                today.push(s);
            else if (isYesterday(s.latest_message_at))
                yesterday.push(s);
            else if (isWithinDays(s.latest_message_at, 7))
                last7.push(s);
            else if (isWithinDays(s.latest_message_at, 30))
                last30.push(s);
            else
                older.push(s);
        }
        const groups = [];
        const add = (key, label, list) => {
            if (list.length > 0) {
                groups.push({ key, label, sessions: list, collapsed: collapsedGroups.value.has(key) });
            }
        };
        add('pinned', '置顶', pinned);
        add('today', '今天', today);
        add('yesterday', '昨天', yesterday);
        add('last7', '最近 7 天', last7);
        add('last30', '最近 30 天', last30);
        add('older', '更早', older);
        return groups;
    });
    const toggleGroupCollapse = (key) => {
        const next = new Set(collapsedGroups.value);
        if (next.has(key))
            next.delete(key);
        else
            next.add(key);
        collapsedGroups.value = next;
    };
    const stats = computed(() => {
        const list = toValue(sessions) ?? [];
        return {
            all: list.length,
            pinned: list.filter((s) => s.pinned).length,
            running: list.filter((s) => s.status === 'running' || s.status === 'pending').length,
            shared: list.filter((s) => s.is_shared).length,
        };
    });
    return {
        activeFilter,
        searchQuery,
        filteredSessions,
        groupedSessions,
        stats,
        toggleGroupCollapse,
        setFilter: (f) => { activeFilter.value = f; },
        setSearchQuery: (q) => { searchQuery.value = q; },
    };
}
