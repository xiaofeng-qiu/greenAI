/**
 * Milliseconds to wait before the next subscribe-message send attempt,
 * based on how many failures have already been recorded (after this failure increments the count).
 */
export function subscribeNotifyRetryDelayMs(
  failCountAfterThisFailure: number
): number {
  switch (failCountAfterThisFailure) {
    case 1:
      return 2 * 60 * 1000;
    case 2:
      return 5 * 60 * 1000;
    case 3:
      return 15 * 60 * 1000;
    case 4:
      return 30 * 60 * 1000;
    default:
      return 60 * 60 * 1000;
  }
}
