export default class LuckyError extends Error {
  constructor(
    message: string,
    public retryable = false,
    public retryAfter = 0,
    public code = '',
  ) {
    super(message);
  }
}
