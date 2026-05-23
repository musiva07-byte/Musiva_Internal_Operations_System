import { format } from "date-fns";

export function formatDate(value: string | Date) {
  return format(new Date(value), "dd MMM yyyy");
}

export function formatDateTime(value: string | Date) {
  return format(new Date(value), "dd MMM yyyy, h:mm a");
}
