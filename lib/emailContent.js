export function sanitizeEmailHtml(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/<(?!\/?(?:p|br|strong|b|em|i|u|ol|ul|li|a)(?:\s|>))[^>]*>/gi, '')
    .replace(/<a([^>]+href\s*=\s*["'])(?!https?:\/\/|mailto:)[^"']*(["'][^>]*)>/gi, '<a$1#$2>')
    .slice(0, 200000);
}

export function htmlToText(value) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<li>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
    .slice(0, 100000);
}

export function substituteVariables(value, variables) {
  return String(value || '').replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (match, key) => {
    const replacement = variables?.[key.toLowerCase()];
    return replacement === undefined || replacement === null ? match : String(replacement).slice(0, 5000);
  });
}
