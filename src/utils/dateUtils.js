const IST_TIME_ZONE = 'Asia/Kolkata';

const toValidDate = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDateTimeIST = (date) => {
  const value = toValidDate(date);
  if (!value) return '-';

  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(value);

  return formatted.replace(/\b(am|pm)\b/i, (match) => match.toUpperCase());
};

export const formatDateIST = (date) => {
  const value = toValidDate(date);
  if (!value) return '-';

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: IST_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(value);
};

export const getLatestTimestamp = (record) => {
  if (!record || typeof record !== 'object') return null;

  const candidates = [
    record.updated_at,
    record.updatedAt,
    record.created_at,
    record.createdAt,
    record.serviceDate,
    record.date,
  ];

  for (const candidate of candidates) {
    const date = toValidDate(candidate);
    if (date) return date.getTime();
  }

  return null;
};

export const sortByLatestUpdated = (records = []) =>
  [...records].sort((left, right) => {
    const leftTimestamp = getLatestTimestamp(left) ?? 0;
    const rightTimestamp = getLatestTimestamp(right) ?? 0;

    if (rightTimestamp !== leftTimestamp) {
      return rightTimestamp - leftTimestamp;
    }

    const leftId = String(left?.id ?? left?._id ?? '');
    const rightId = String(right?.id ?? right?._id ?? '');
    return rightId.localeCompare(leftId);
  });
