/**
 * Cron Expression Helper Utility
 *
 * Provides tools for working with Amazon EventBridge cron expressions
 * Format: Minutes Hours Day-of-month Month Day-of-week [Year]
 */

/**
 * Common cron presets for easy use
 */
export const CRON_PRESETS = {
  'every-minute': {
    expression: '* * * * ? *',
    description: 'Every minute'
  },
  'every-5-minutes': {
    expression: '*/5 * * * ? *',
    description: 'Every 5 minutes'
  },
  'every-15-minutes': {
    expression: '*/15 * * * ? *',
    description: 'Every 15 minutes'
  },
  'every-30-minutes': {
    expression: '*/30 * * * ? *',
    description: 'Every 30 minutes'
  },
  'hourly': {
    expression: '0 * * * ? *',
    description: 'Every hour at minute 0'
  },
  'daily-midnight': {
    expression: '0 0 * * ? *',
    description: 'Daily at midnight (00:00 UTC)'
  },
  'daily-morning': {
    expression: '0 9 * * ? *',
    description: 'Daily at 9:00 AM UTC'
  },
  'daily-afternoon': {
    expression: '0 14 * * ? *',
    description: 'Daily at 2:00 PM UTC'
  },
  'weekly-monday': {
    expression: '0 9 ? * 2 *',
    description: 'Weekly on Monday at 9:00 AM UTC'
  },
  'weekly-friday': {
    expression: '0 17 ? * 6 *',
    description: 'Weekly on Friday at 5:00 PM UTC'
  },
  'monthly-first': {
    expression: '0 0 1 * ? *',
    description: 'Monthly on the 1st at midnight UTC'
  },
  'monthly-last-business-day': {
    expression: '0 18 L * ? *',
    description: 'Monthly on the last day at 6:00 PM UTC'
  }
};

/**
 * Parse a cron expression into human-readable description
 *
 * @param {string} cronExpression - The cron expression to parse
 * @returns {string} Human-readable description
 */
export function parseCronExpression(cronExpression) {
  try {
    const parts = cronExpression.trim().split(/\s+/);

    if (parts.length < 5 || parts.length > 6) {
      return 'Invalid cron expression format';
    }

    const [minutes, hours, dayOfMonth, month, dayOfWeek, year] = parts;

    // Check for preset match
    const preset = Object.entries(CRON_PRESETS).find(([_, p]) => p.expression === cronExpression);
    if (preset) {
      return preset[1].description;
    }

    let description = 'Runs ';

    // Parse minutes
    const minuteDesc = parseField(minutes, 'minute', 'minutes');

    // Parse hours
    const hourDesc = parseField(hours, 'hour', 'hours');

    // Parse day of month
    const dayDesc = parseField(dayOfMonth, 'day', 'days');

    // Parse month
    const monthDesc = parseField(month, 'month', 'months');

    // Parse day of week
    const dowDesc = parseDayOfWeek(dayOfWeek);

    // Construct description
    if (minutes === '*' && hours === '*') {
      description += 'every minute';
    } else if (hours === '*') {
      description += `${minuteDesc} of every hour`;
    } else if (dayOfMonth === '*' && dayOfWeek === '?') {
      description += `${minuteDesc} at ${hourDesc} every day`;
    } else if (dayOfWeek !== '?') {
      description += `${minuteDesc} at ${hourDesc} on ${dowDesc}`;
    } else if (dayOfMonth !== '*' && dayOfMonth !== '?') {
      description += `${minuteDesc} at ${hourDesc} on ${dayDesc}`;
    } else {
      description += `${minuteDesc} at ${hourDesc}`;
    }

    if (month !== '*') {
      description += ` in ${monthDesc}`;
    }

    if (year && year !== '*') {
      description += ` in ${year}`;
    }

    description += ' (UTC)';

    return description;
  } catch (error) {
    return 'Unable to parse cron expression';
  }
}

/**
 * Parse a single cron field into human-readable text
 */
function parseField(field, singular, plural) {
  if (field === '*') {
    return `every ${singular}`;
  }
  if (field === '?') {
    return 'any';
  }
  if (field.includes('/')) {
    const [, interval] = field.split('/');
    return `every ${interval} ${plural}`;
  }
  if (field.includes('-')) {
    const [start, end] = field.split('-');
    return `${singular} ${start}-${end}`;
  }
  if (field.includes(',')) {
    const values = field.split(',');
    return `${singular} ${values.join(', ')}`;
  }
  if (field === 'L') {
    return 'the last day';
  }
  if (field.includes('L')) {
    return `the last ${singular}`;
  }
  if (field.includes('W')) {
    return `nearest weekday to day ${field.replace('W', '')}`;
  }
  if (field.includes('#')) {
    const [day, week] = field.split('#');
    const ordinal = ['first', 'second', 'third', 'fourth', 'fifth'][parseInt(week) - 1];
    return `${ordinal} occurrence`;
  }
  return `${singular} ${field}`;
}

/**
 * Parse day of week field
 */
function parseDayOfWeek(dow) {
  const days = {
    '1': 'Sunday',
    '2': 'Monday',
    '3': 'Tuesday',
    '4': 'Wednesday',
    '5': 'Thursday',
    '6': 'Friday',
    '7': 'Saturday'
  };

  if (dow === '*' || dow === '?') {
    return 'any day';
  }
  if (dow.includes('/')) {
    const [, interval] = dow.split('/');
    return `every ${interval} days`;
  }
  if (dow.includes('-')) {
    const [start, end] = dow.split('-');
    return `${days[start]} through ${days[end]}`;
  }
  if (dow.includes(',')) {
    const values = dow.split(',').map(d => days[d]);
    if (values.length === 2) {
      return values.join(' and ');
    }
    return values.slice(0, -1).join(', ') + ', and ' + values.slice(-1);
  }
  if (dow.includes('#')) {
    const [day, week] = dow.split('#');
    const ordinal = ['first', 'second', 'third', 'fourth', 'fifth'][parseInt(week) - 1];
    return `the ${ordinal} ${days[day]}`;
  }
  if (dow.includes('L')) {
    return `the last ${days[dow.replace('L', '')]}`;
  }
  return days[dow] || dow;
}

/**
 * Validate a cron expression
 *
 * @param {string} cronExpression - The cron expression to validate
 * @returns {{ valid: boolean, error?: string }} Validation result
 */
export function validateCronExpression(cronExpression) {
  if (!cronExpression || typeof cronExpression !== 'string') {
    return { valid: false, error: 'Cron expression is required' };
  }

  const parts = cronExpression.trim().split(/\s+/);

  if (parts.length < 5 || parts.length > 6) {
    return {
      valid: false,
      error: 'Cron expression must have 5 or 6 fields: Minutes Hours Day-of-month Month Day-of-week [Year]'
    };
  }

  const [minutes, hours, dayOfMonth, month, dayOfWeek, year] = parts;

  // Validate minutes (0-59)
  const minutesValid = validateField(minutes, 0, 59);
  if (!minutesValid.valid) {
    return { valid: false, error: `Minutes field error: ${minutesValid.error}` };
  }

  // Validate hours (0-23)
  const hoursValid = validateField(hours, 0, 23);
  if (!hoursValid.valid) {
    return { valid: false, error: `Hours field error: ${hoursValid.error}` };
  }

  // Validate day of month (1-31 or ?)
  if (dayOfMonth !== '?') {
    const domValid = validateField(dayOfMonth, 1, 31, true);
    if (!domValid.valid) {
      return { valid: false, error: `Day-of-month field error: ${domValid.error}` };
    }
  }

  // Validate month (1-12)
  const monthValid = validateField(month, 1, 12);
  if (!monthValid.valid) {
    return { valid: false, error: `Month field error: ${monthValid.error}` };
  }

  // Validate day of week (1-7 or ?)
  if (dayOfWeek !== '?') {
    const dowValid = validateField(dayOfWeek, 1, 7, true);
    if (!dowValid.valid) {
      return { valid: false, error: `Day-of-week field error: ${dowValid.error}` };
    }
  }

  // Validate that either day-of-month OR day-of-week uses ?, not both as non-?
  if (dayOfMonth !== '?' && dayOfWeek !== '?') {
    return {
      valid: false,
      error: 'Either day-of-month or day-of-week must be "?" (cannot specify both)'
    };
  }

  // Validate that at least one of day-of-month or day-of-week is specified
  if (dayOfMonth === '?' && dayOfWeek === '?') {
    return {
      valid: false,
      error: 'Either day-of-month or day-of-week must be specified (cannot both be "?")'
    };
  }

  // Validate year if provided (1970-2199)
  if (year) {
    const yearValid = validateField(year, 1970, 2199);
    if (!yearValid.valid) {
      return { valid: false, error: `Year field error: ${yearValid.error}` };
    }
  }

  return { valid: true };
}

/**
 * Validate a single cron field
 */
function validateField(field, min, max, allowSpecial = false) {
  // Allow wildcards
  if (field === '*') {
    return { valid: true };
  }

  // Allow special characters for day fields
  if (allowSpecial && (field === '?' || field === 'L' || field.includes('W') || field.includes('#'))) {
    return { valid: true };
  }

  // Validate ranges (e.g., "1-5")
  if (field.includes('-')) {
    const [start, end] = field.split('-').map(Number);
    if (isNaN(start) || isNaN(end) || start < min || end > max || start >= end) {
      return { valid: false, error: `Invalid range ${field}` };
    }
    return { valid: true };
  }

  // Validate steps (e.g., "*/5" or "10-20/2")
  if (field.includes('/')) {
    const [range, step] = field.split('/');
    const stepNum = Number(step);
    if (isNaN(stepNum) || stepNum < 1) {
      return { valid: false, error: `Invalid step value ${step}` };
    }
    if (range !== '*') {
      return validateField(range, min, max);
    }
    return { valid: true };
  }

  // Validate lists (e.g., "1,3,5")
  if (field.includes(',')) {
    const values = field.split(',').map(Number);
    for (const val of values) {
      if (isNaN(val) || val < min || val > max) {
        return { valid: false, error: `Invalid value ${val} in list` };
      }
    }
    return { valid: true };
  }

  // Validate single number
  const num = Number(field);
  if (isNaN(num) || num < min || num > max) {
    return { valid: false, error: `Value must be between ${min} and ${max}` };
  }

  return { valid: true };
}

/**
 * Build a cron expression from components
 *
 * @param {Object} components - Cron expression components
 * @param {string} components.minutes - Minutes field
 * @param {string} components.hours - Hours field
 * @param {string} components.dayOfMonth - Day of month field
 * @param {string} components.month - Month field
 * @param {string} components.dayOfWeek - Day of week field
 * @param {string} [components.year] - Year field (optional)
 * @returns {string} Complete cron expression
 */
export function buildCronExpression(components) {
  const { minutes, hours, dayOfMonth, month, dayOfWeek, year } = components;

  const parts = [
    minutes || '*',
    hours || '*',
    dayOfMonth || '?',
    month || '*',
    dayOfWeek || '?'
  ];

  if (year) {
    parts.push(year);
  }

  return parts.join(' ');
}

/**
 * Calculate the next execution time for a cron expression
 * Note: This is a simplified approximation for display purposes
 *
 * @param {string} cronExpression - The cron expression
 * @returns {Date|null} Next execution time or null if unable to calculate
 */
export function getNextExecutionTime(cronExpression) {
  try {
    const parts = cronExpression.trim().split(/\s+/);
    if (parts.length < 5) return null;

    const [minutes, hours, dayOfMonth, month, dayOfWeek] = parts;
    const now = new Date();
    const next = new Date(now);

    // Simple calculation for common cases
    if (minutes === '*' && hours === '*') {
      // Every minute
      next.setMinutes(next.getMinutes() + 1);
      next.setSeconds(0);
      return next;
    }

    if (hours === '*') {
      // Every hour at specific minute(s)
      const targetMinute = minutes === '*' ? 0 : parseInt(minutes);
      next.setMinutes(targetMinute);
      next.setSeconds(0);
      if (next <= now) {
        next.setHours(next.getHours() + 1);
      }
      return next;
    }

    if (minutes.includes('/')) {
      // Interval-based (e.g., */5)
      const interval = parseInt(minutes.split('/')[1]);
      const currentMinute = now.getMinutes();
      const nextMinute = Math.ceil(currentMinute / interval) * interval;
      next.setMinutes(nextMinute);
      next.setSeconds(0);
      if (next <= now) {
        next.setHours(next.getHours() + 1);
        next.setMinutes(0);
      }
      return next;
    }

    // For daily/weekly schedules
    const targetHour = parseInt(hours);
    const targetMinute = parseInt(minutes);
    next.setHours(targetHour);
    next.setMinutes(targetMinute);
    next.setSeconds(0);

    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }

    return next;
  } catch (error) {
    return null;
  }
}

/**
 * Format time remaining until next execution
 *
 * @param {Date} nextExecution - Next execution time
 * @returns {string} Human-readable time remaining
 */
export function formatTimeRemaining(nextExecution) {
  if (!nextExecution) return 'Unknown';

  const now = new Date();
  const diff = nextExecution - now;

  if (diff < 0) return 'Past due';

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''}, ${hours % 24} hour${hours % 24 !== 1 ? 's' : ''}`;
  }
  if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''}, ${minutes % 60} minute${minutes % 60 !== 1 ? 's' : ''}`;
  }
  if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''}, ${seconds % 60} second${seconds % 60 !== 1 ? 's' : ''}`;
  }
  return `${seconds} second${seconds !== 1 ? 's' : ''}`;
}

/**
 * Get list of preset options for display
 *
 * @returns {Array} Array of preset objects with name and description
 */
export function getPresetOptions() {
  return Object.entries(CRON_PRESETS).map(([key, value]) => ({
    name: value.description,
    value: value.expression,
    key
  }));
}

export default {
  CRON_PRESETS,
  parseCronExpression,
  validateCronExpression,
  buildCronExpression,
  getNextExecutionTime,
  formatTimeRemaining,
  getPresetOptions
};
