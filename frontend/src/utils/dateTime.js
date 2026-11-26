/**
 * Utility functions for localized date and time display.
 * Avoids any hardcoded placeholder time strings (e.g. "10:00 AM", "11:00 AM")
 * and formats real timestamps into user's local timezone (en-IN 12-hour format).
 */

export function formatTime(timestampOrIso) {
  if (!timestampOrIso) return '';
  if (typeof timestampOrIso === 'string') {
    // If it's already a clean time string like "11:30 AM" or "02:45 PM"
    if (!timestampOrIso.includes('T') && !timestampOrIso.includes('-') && /AM|PM/i.test(timestampOrIso)) {
      return timestampOrIso;
    }
  }

  try {
    const d = new Date(timestampOrIso);
    if (isNaN(d.getTime())) return String(timestampOrIso);
    return new Intl.DateTimeFormat('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(d);
  } catch (e) {
    return String(timestampOrIso);
  }
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`);
    if (isNaN(d.getTime())) return String(dateStr);
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(d);
  } catch (e) {
    return String(dateStr);
  }
}

/**
 * Derives contextual time string for a visit card or calendar entry:
 * - If checked out: formats check_out_time
 * - Else if checked in: formats check_in_time
 * - Else (not yet checked in): formats created_at (or scheduled_time if provided)
 */
export function getVisitTimeString(visit) {
  if (!visit) return '';
  const checkOut = visit.check_out_time || visit.check_out?.time;
  if (checkOut) {
    return formatTime(checkOut);
  }
  const checkIn = visit.check_in_time || visit.check_in?.time;
  if (checkIn) {
    return formatTime(checkIn);
  }
  if (visit.created_at) {
    return formatTime(visit.created_at);
  }
  if (visit.scheduled_time) {
    return formatTime(visit.scheduled_time);
  }
  return '';
}

/**
 * Returns formatted time display with status label for Executive Schedule:
 * - Checked Out: 04:30 PM
 * - Checked In: 10:15 AM
 * - Scheduled: 09:30 AM (from created_at or scheduled_time)
 */
export function formatVisitScheduleTime(visit) {
  if (!visit) return 'Scheduled';
  const checkOut = visit.check_out_time || visit.check_out?.time;
  if (checkOut) {
    return `Checked Out: ${formatTime(checkOut)}`;
  }
  const checkIn = visit.check_in_time || visit.check_in?.time;
  if (checkIn) {
    return `Checked In: ${formatTime(checkIn)}`;
  }
  if (visit.created_at) {
    return `Scheduled: ${formatTime(visit.created_at)}`;
  }
  if (visit.scheduled_time) {
    return `Scheduled: ${formatTime(visit.scheduled_time)}`;
  }
  return 'Scheduled';
}
