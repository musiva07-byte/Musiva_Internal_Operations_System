export type ServiceResult<T> =
  | {
      data: T;
      error: null;
    }
  | {
      data: null;
      error: string;
    };

export function serviceSuccess<T>(data: T): ServiceResult<T> {
  return { data, error: null };
}

export function serviceError<T>(message = "Something went wrong. Please try again."): ServiceResult<T> {
  return { data: null, error: message };
}
