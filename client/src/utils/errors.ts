/** Extracts a displayable message from an unknown error. */
export function errorMessage(err: unknown, fallback = 'Something went wrong'): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/** Explains microphone failures in plain language. */
export function microphoneErrorMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : '';
  if (name === 'NotAllowedError') return 'Microphone access was blocked. Allow it in your browser and try again.';
  if (name === 'NotFoundError') return 'No microphone was found on this device.';
  if (name === 'NotReadableError') return 'Your microphone is being used by another application.';
  return errorMessage(err, 'Could not start voice');
}
