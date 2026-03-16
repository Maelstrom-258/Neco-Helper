function cleanEmpty(obj) {
    if (Array.isArray(obj)) {
        return obj
            .map(v => (v && typeof v === 'object' ? cleanEmpty(v) : v))
            .filter(v => !(v == null || v === '' || (Array.isArray(v) && v.length === 0) || (typeof v === 'object' && Object.keys(v).length === 0)));
    } else if (Object.prototype.toString.call(obj) === '[object Object]') {
        return Object.entries(obj)
            .reduce((acc, [k, v]) => {
                const cleaned = v && typeof v === 'object' ? cleanEmpty(v) : v;
                if (!(cleaned == null || cleaned === '' || (Array.isArray(cleaned) && cleaned.length === 0) || (typeof cleaned === 'object' && Object.keys(cleaned).length === 0))) {
                    acc[k] = cleaned;
                }
                return acc;
            }, {});
    }
    return obj;
}

module.exports = { cleanEmpty };
