import { ValidateError } from 'tsoa';

// Makes tsoa ValidationError cleaner
export function validationErrorCleaner(error: ValidateError) {
  return Object.entries(error.fields).map(([field, fieldError]) => {
    if (
      fieldError.message &&
      fieldError.message.includes('Could not match the union against any of the items')
    ) {
      try {
        const issuesJson = fieldError.message.match(/Issues: (\[.*\])/)?.[1] || '[]';
        const issues = JSON.parse(issuesJson);

        const firstIssue = issues[0];
        const firstField = Object.keys(firstIssue)[0];
        const firstError = firstIssue[firstField];

        return {
          field,
          message: firstError.message,
          value: fieldError.value,
        };
      } catch {
        return {
          field,
          message: 'Validation failed',
          value: fieldError.value,
        };
      }
    }

    return {
      field,
      message: fieldError.message,
      value: fieldError.value,
    };
  });
}
