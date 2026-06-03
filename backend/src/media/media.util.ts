import { Types } from 'mongoose';

export function isValidMediaId(id: string): boolean {
  return Types.ObjectId.isValid(id);
}

export function toMediaId(value: Types.ObjectId | string | null | undefined): string | null {
  if (!value) return null;
  return typeof value === 'string' ? value : value.toString();
}
