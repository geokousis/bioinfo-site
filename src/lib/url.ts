const ABSOLUTE_SCHEME_PATTERN = /^[a-z][a-z\d+\-.]*:/i;

export const resolveAppUrl = (value: string | null | undefined): string => {
  if (!value) {
    return '';
  }

  if (
    value.startsWith('#') ||
    value.startsWith('//') ||
    ABSOLUTE_SCHEME_PATTERN.test(value) ||
    value.startsWith('./') ||
    value.startsWith('../')
  ) {
    return value;
  }

  const base = import.meta.env.BASE_URL || '/';
  const normalizedPath = value.replace(/^\/+/, '');
  return `${base}${normalizedPath}`;
};
