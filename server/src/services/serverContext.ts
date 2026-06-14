const DEFAULT_TZ = 'Asia/Shanghai';

export function getServerTimezone(): string {
  return process.env.TZ || DEFAULT_TZ;
}

export interface ServerDateParts {
  year: number;
  month: number;
  day: number;
  hour: string;
  minute: string;
  weekday: string;
  timezone: string;
}

export function getServerDateParts(): ServerDateParts {
  const tz = getServerTimezone();
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('zh-CN', {
    timeZone: tz,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';

  const weekdayMap: Record<string, string> = {
    周日: '日',
    周一: '一',
    周二: '二',
    周三: '三',
    周四: '四',
    周五: '五',
    周六: '六',
  };
  const weekdayRaw = get('weekday');
  const weekday = weekdayMap[weekdayRaw] ?? weekdayRaw.replace('周', '');

  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: get('hour'),
    minute: get('minute'),
    weekday,
    timezone: tz,
  };
}

export function getServerDateTimeLine(): string {
  const p = getServerDateParts();
  return `${p.year}年${p.month}月${p.day}日 星期${p.weekday} ${p.hour}:${p.minute}`;
}

export function getServerDatetimeContextBlock(): string {
  const p = getServerDateParts();
  return `【当前服务器时间】${getServerDateTimeLine()}（${p.timezone}）。回答涉及「今天/现在/今年/当前日期」时必须以此为准，禁止使用模型记忆中的旧日期（如2023年）。`;
}

export function getServerDatePrefix(): string {
  const p = getServerDateParts();
  return `${p.year}年${p.month}月${p.day}日`;
}
