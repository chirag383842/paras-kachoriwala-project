import type { StoreStatus } from './types.js';

export const BRAND = {
  name: 'Paras Kachoriwala',
  tagline: 'Fresh • Famous • Full of Taste',
  description:
    'Serving delicious Kachori (Regular, Jain & Swaminarayan) and Bhel loved by our customers for years. A trusted local food destination, famous for taste and freshness.',
  address: 'Paras Kachoriwala, Below SK Mobile, Near Sangam Char Rasta, Vadodara, Gujarat, India.',
  mapsLink:
    'https://www.google.com/maps/place/Paras+Kachoriwala/@22.3190231,73.2123269,767m/data=!3m2!1e3!4b1!4m6!3m5!1s0x395fcf6ea8cd0e57:0x9044eec97be95ff3!8m2!3d22.3190231!4d73.2123269!16s%2Fg%2F11f3n1ykv_?entry=ttu&g_ep=EgoyMDI2MTEwMi4wIKXMDSoASAFQAw%3D%3D',
  mapsEmbed:
    'https://www.google.com/maps/place/Paras+Kachoriwala/@22.3190231,73.2123269,767m/data=!3m2!1e3!4b1!4m6!3m5!1s0x395fcf6ea8cd0e57:0x9044eec97be95ff3!8m2!3d22.3190231!4d73.2123269!16s%2Fg%2F11f3n1ykv_?entry=ttu&g_ep=EgoyMDI2MTEwMi4wIKXMDSoASAFQAw%3D%3D',
  phone: '',
  timezone: 'Asia/Kolkata',
  paymentNote: 'Cash Payment Only • Token System at Counter',
  orderingNote: 'Only cash payment accepted. Token system operated at the counter for fresh and orderly service.',
};

export const STORE_HOURS = [
  { day: 'Monday', open: '19:30', close: '24:00', display: '7:30 PM – 12:00 AM' },
  { day: 'Tuesday', open: '19:30', close: '24:00', display: '7:30 PM – 12:00 AM' },
  { day: 'Wednesday', open: '19:30', close: '24:00', display: '7:30 PM – 12:00 AM' },
  { day: 'Thursday', open: '19:30', close: '24:00', display: '7:30 PM – 12:00 AM' },
  { day: 'Friday', open: '19:30', close: '24:00', display: '7:30 PM – 12:00 AM' },
  { day: 'Saturday', open: '19:30', close: '24:00', display: '7:30 PM – 12:00 AM' },
  { day: 'Sunday', open: '19:30', close: '24:00', display: '7:30 PM – 12:00 AM' },
];

export type CrowdLevel = 'Low' | 'Moderate' | 'Busy' | 'Very Busy';

export const CROWD_META: Record<CrowdLevel, { label: string; color: string; dot: string }> = {
  Low: { label: 'Low Crowd', color: 'text-leaf-600', dot: 'bg-leaf-500' },
  Moderate: { label: 'Moderate Crowd', color: 'text-marigold-600', dot: 'bg-marigold-500' },
  Busy: { label: 'Busy', color: 'text-spice-600', dot: 'bg-spice-500' },
  'Very Busy': { label: 'Very Busy', color: 'text-red-600', dot: 'bg-red-500' },
};

/**
 * Returns date and time components in Indian Standard Time (Asia/Kolkata)
 */
export function getISTDate(date: Date = new Date()): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  dayOfWeek: number; // 0 for Sunday, 1 for Monday, ..., 6 for Saturday
  dateString: string; // YYYY-MM-DD
  dayName: string;
} {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: BRAND.timezone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
    hourCycle: 'h23',
    weekday: 'long',
  });

  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};
  parts.forEach((p) => {
    map[p.type] = p.value;
  });

  const year = parseInt(map.year, 10);
  const month = parseInt(map.month, 10);
  const day = parseInt(map.day, 10);
  const hour = parseInt(map.hour === '24' ? '0' : map.hour, 10);
  const minute = parseInt(map.minute, 10);
  const dayName = map.weekday;

  const daysArr = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayOfWeek = daysArr.indexOf(dayName) >= 0 ? daysArr.indexOf(dayName) : 0;

  const dateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return { year, month, day, hour, minute, dayOfWeek, dateString, dayName };
}

/**
 * Checks if current time is within normal operating schedule hours (7:30 PM - 12:00 AM IST)
 */
export function isWithinScheduleHours(now: Date = new Date()): boolean {
  const { dayOfWeek, hour, minute } = getISTDate(now);
  const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const todaySchedule = STORE_HOURS[dayIndex] ?? STORE_HOURS[0];

  const currentMinutes = hour * 60 + minute;
  const [oh, om] = todaySchedule.open.split(':').map(Number);
  const [ch, cm] = todaySchedule.close.split(':').map(Number);

  return currentMinutes >= oh * 60 + om && currentMinutes < ch * 60 + cm;
}

/**
 * Computes active store status taking into account:
 * 1. "Close Shop for Today" / Immediate Close:
 *    - Strictly applies for the current day in IST.
 *    - Automatically expires the next day at midnight (12:00 AM) IST so the store reopens at 7:30 PM.
 * 2. Admin "OPEN NOW" / Force Open override:
 *    - Strictly applies for the current day in IST.
 *    - Automatically closes at 12:00 AM (midnight) IST on the next day.
 *    - After closing at midnight, automatically opens again at 7:30 PM per daily schedule.
 * 3. Automatic Daily Schedule:
 *    - Opens at 7:30 PM and closes at 12:00 AM Midnight IST daily.
 *    - Automatically shows "Currently Closed • Opens Today at 7:30 PM" during daytime (12:00 AM - 7:30 PM).
 */
export function calculateStoreStatus(status?: StoreStatus | null): {
  isOpen: boolean;
  isClosedForToday: boolean;
  isForcedOpen: boolean;
  isAutoScheduled: boolean;
  nextOpenText: string;
  todayScheduleDisplay: string;
  statusLabel: string;
  currentISTTimeDisplay: string;
} {
  const ist = getISTDate();
  const currentMinutes = ist.hour * 60 + ist.minute;
  const dayIndex = ist.dayOfWeek === 0 ? 6 : ist.dayOfWeek - 1;
  const todaySchedule = STORE_HOURS[dayIndex] ?? STORE_HOURS[0];
  const [oh, om] = todaySchedule.open.split(':').map(Number);
  const openMinutes = oh * 60 + om; // 1170 minutes = 7:30 PM
  const [ch, cm] = todaySchedule.close.split(':').map(Number);
  const closeMinutes = ch * 60 + cm; // 1440 minutes = 12:00 AM midnight

  const inScheduleHours = currentMinutes >= openMinutes && currentMinutes < closeMinutes;
  const nextText = currentMinutes < openMinutes ? 'Opens Today at 7:30 PM' : 'Opens Tomorrow at 7:30 PM';

  const istHour12 = ist.hour % 12 || 12;
  const istAmPm = ist.hour >= 12 ? 'PM' : 'AM';
  const istTimeStr = `${istHour12}:${String(ist.minute).padStart(2, '0')} ${istAmPm} IST`;

  // 0. Author explicitly resumed the automatic schedule.
  //    This mode never latches: the status is always derived from the IST clock
  //    so the shop reopens at 7:30 PM even if no browser or Admin Panel is open.
  if (status?.override_mode === 'auto') {
    return {
      isOpen: inScheduleHours,
      isClosedForToday: false,
      isForcedOpen: false,
      isAutoScheduled: true,
      nextOpenText: inScheduleHours ? 'Open Now (7:30 PM – 12:00 AM)' : nextText,
      todayScheduleDisplay: todaySchedule.display,
      statusLabel: inScheduleHours ? 'Open Now' : 'Currently Closed',
      currentISTTimeDisplay: istTimeStr,
    };
  }

  // Determine the IST date on which this status / override was recorded
  let lastUpdatedISTDate: string | null = null;
  if (status?.last_updated) {
    try {
      lastUpdatedISTDate = getISTDate(new Date(status.last_updated)).dateString;
    } catch {
      lastUpdatedISTDate = null;
    }
  }

  // 1. Admin selected "Close Shop for Today" for TODAY
  const isClosedTodayByAuthor =
    (status?.override_mode === 'closed_today' || status?.override_mode === 'force_close') &&
    (!status?.closed_for_date || status.closed_for_date === ist.dateString) &&
    (!lastUpdatedISTDate || lastUpdatedISTDate === ist.dateString);

  if (isClosedTodayByAuthor || (status?.closed_for_date === ist.dateString && status?.override_mode !== 'closed_now')) {
    return {
      isOpen: false,
      isClosedForToday: true,
      isForcedOpen: false,
      isAutoScheduled: false,
      nextOpenText: 'The shop is open tomorrow at 7:30 PM',
      todayScheduleDisplay: todaySchedule.display,
      statusLabel: 'Closed for Today',
      currentISTTimeDisplay: istTimeStr,
    };
  }

  // 2. Admin selected "CLOSED NOW" for TODAY
  const isClosedNowByAuthor =
    status?.override_mode === 'closed_now' &&
    (!status?.closed_for_date || status.closed_for_date === ist.dateString) &&
    (!lastUpdatedISTDate || lastUpdatedISTDate === ist.dateString);

  if (isClosedNowByAuthor) {
    return {
      isOpen: false,
      isClosedForToday: true,
      isForcedOpen: false,
      isAutoScheduled: false,
      nextOpenText: inScheduleHours ? 'Closed currently by author' : nextText,
      todayScheduleDisplay: todaySchedule.display,
      statusLabel: 'Closed currently by author',
      currentISTTimeDisplay: istTimeStr,
    };
  }

  // 3. Admin selected "OPEN NOW" / Force Open for TODAY:
  // Strictly valid for today (until midnight). At 12:00 AM midnight (next day), it automatically expires and closes.
  const isForcedOpenTodayStrict =
    (status?.force_open_date === ist.dateString && status?.is_open === true) ||
    (status?.override_mode === 'force_open' &&
      (!status?.force_open_date || status.force_open_date === ist.dateString) &&
      (!lastUpdatedISTDate || lastUpdatedISTDate === ist.dateString));

  if (isForcedOpenTodayStrict) {
    return {
      isOpen: true,
      isClosedForToday: false,
      isForcedOpen: true,
      isAutoScheduled: false,
      nextOpenText: 'Open currently by author',
      todayScheduleDisplay: todaySchedule.display,
      statusLabel: 'Open currently by author',
      currentISTTimeDisplay: istTimeStr,
    };
  }

  // 4. If any override was recorded on a past day (yesterday or earlier), it has expired!
  // At midnight (12:00 AM), it resets and follows the regular schedule:
  // - Between 12:00 AM and 7:30 PM: CLOSED (Opens Today at 7:30 PM)
  // - At 7:30 PM: OPENS automatically (Open Now)
  const isOverrideFromPastDay =
    (status?.closed_for_date && status.closed_for_date < ist.dateString) ||
    (status?.force_open_date && status.force_open_date < ist.dateString) ||
    (lastUpdatedISTDate && lastUpdatedISTDate < ist.dateString);

  if (isOverrideFromPastDay) {
    return {
      isOpen: inScheduleHours,
      isClosedForToday: false,
      isForcedOpen: false,
      isAutoScheduled: true,
      nextOpenText: inScheduleHours ? 'Open Now (7:30 PM – 12:00 AM)' : nextText,
      todayScheduleDisplay: todaySchedule.display,
      statusLabel: inScheduleHours ? 'Open Now' : 'Currently Closed',
      currentISTTimeDisplay: istTimeStr,
    };
  }

  // 5. If admin explicitly closed stall right now TODAY
  if (status && status.is_open === false && (!lastUpdatedISTDate || lastUpdatedISTDate === ist.dateString)) {
    return {
      isOpen: false,
      isClosedForToday: true,
      isForcedOpen: false,
      isAutoScheduled: false,
      nextOpenText: inScheduleHours ? 'Closed currently by author' : nextText,
      todayScheduleDisplay: todaySchedule.display,
      statusLabel: 'Closed currently by author',
      currentISTTimeDisplay: istTimeStr,
    };
  }

  // 6. If admin explicitly opened stall TODAY
  if (status && status.is_open === true && (!lastUpdatedISTDate || lastUpdatedISTDate === ist.dateString)) {
    return {
      isOpen: true,
      isClosedForToday: false,
      isForcedOpen: !inScheduleHours,
      isAutoScheduled: inScheduleHours,
      nextOpenText: inScheduleHours ? 'Open Now (7:30 PM – 12:00 AM)' : 'Open currently by author',
      todayScheduleDisplay: todaySchedule.display,
      statusLabel: inScheduleHours ? 'Open Now' : 'Open currently by author',
      currentISTTimeDisplay: istTimeStr,
    };
  }

  // 7. Default / Fallback: Automatic Schedule (7:30 PM to 12:00 AM Midnight IST)
  return {
    isOpen: inScheduleHours,
    isClosedForToday: false,
    isForcedOpen: false,
    isAutoScheduled: true,
    nextOpenText: inScheduleHours ? 'Open Now (7:30 PM – 12:00 AM)' : nextText,
    todayScheduleDisplay: todaySchedule.display,
    statusLabel: inScheduleHours ? 'Open Now' : 'Currently Closed',
    currentISTTimeDisplay: istTimeStr,
  };
}

export function isStoreOpenNow(status?: StoreStatus | null): boolean {
  return calculateStoreStatus(status).isOpen;
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-IN', {
    timeZone: BRAND.timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatTimeStr(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  if (h === 24 || h === 0) {
    return `12:${m.toString().padStart(2, '0')} AM`;
  }
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
}
