export const sanitizeFileName = (value: unknown): string => {
  const name = String(value ?? '').trim();
  const baseName = name.replace(/^.*[\\/]/, '');
  const sanitized = baseName
    .replace(/[\u0000-\u001F<>:"/\\|?*\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^\.+/, '')
    .replace(/\.+$/, '')
    .trim();

  return sanitized || 'Attachment';
};
