function replaceVariables(text, { user, ticketId }) {
    if (!text) return '';

    const date = new Date();
    const dd = date.getDate().toString().padStart(2, '0');
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
    const yyyy = date.getFullYear().toString();
    const timecreated = `${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}:${date.getSeconds().toString().padStart(2,'0')}`;

    let result = text
        .replace(/{?timecreated}?/gi, timecreated)
        .replace(/{?dd}?/gi, dd)
        .replace(/{?mm}?/gi, mm)
        .replace(/{?yyyy}?/gi, yyyy)
        .replace(/{?username}?/gi, user.username.replace(/[^a-zA-Z0-9-]/g, ''))
        .replace(/{?userid}?/gi, user.id)
        .replace(/{?ticketnumber}?/gi, ticketId);

    return result;
}

module.exports = { replaceVariables };
