import { fromDate, toCalendarDate } from '@internationalized/date';

export function startOfTomorrowInTimeZone(date: Date, timeZone: string) {
	const today = toCalendarDate(fromDate(date, timeZone));
	return today.add({ days: 1 }).toDate(timeZone);
}
