type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogFields {
  [key: string]: unknown;
}

/** Structured JSON logger. TODO(Step: monitoring): forward errors to Sentry. */
function log(level: LogLevel, action: string, fields: LogFields = {}): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: 'backend',
    action,
    ...fields,
  };
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (action: string, fields?: LogFields) => log('debug', action, fields),
  info: (action: string, fields?: LogFields) => log('info', action, fields),
  warn: (action: string, fields?: LogFields) => log('warn', action, fields),
  error: (action: string, fields?: LogFields) => log('error', action, fields),
};
