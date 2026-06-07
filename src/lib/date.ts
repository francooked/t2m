import { fromDate, toCalendarDate } from '@internationalized/date';
import type { TIME_ZONES } from './constants';

export function startOfTomorrowInTimeZone(date: Date, timeZone: (typeof TIME_ZONES)[number]) {
	const today = toCalendarDate(fromDate(date, timeZone));
	return today.add({ days: 1 }).toDate(timeZone);
}
