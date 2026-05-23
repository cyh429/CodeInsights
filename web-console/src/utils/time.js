export const parseISODateTime = (isoString) => {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
        throw new Error(`Failed to parse ISO datetime string: ${isoString}`);
    }
    return Math.floor(date.getTime() / 1000);
};
export const formatRelativeTime = (timestamp) => {
    const diffSec = Math.floor(Date.now() / 1000) - timestamp;
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    const diffMonth = Math.floor(diffDay / 30);
    const diffYear = Math.floor(diffMonth / 12);
    if (diffSec < 60)
        return '刚刚';
    if (diffMin < 60)
        return `${diffMin} 分钟前`;
    if (diffHour < 24)
        return `${diffHour} 小时前`;
    if (diffDay < 30)
        return `${diffDay} 天前`;
    if (diffMonth < 12)
        return `${diffMonth} 个月前`;
    return `${diffYear} 年前`;
};
export const formatCustomTime = (timestamp) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        });
    }
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    if (date >= startOfWeek && date <= endOfWeek) {
        const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        return weekdays[date.getDay()];
    }
    if (date.getFullYear() === now.getFullYear()) {
        return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
    }
    return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}`;
};
