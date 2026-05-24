import type { ClassId } from '$lib/db/types';
import { scheduleClassFlush } from './flush';

export function notifyClassDirty(classId: ClassId): void {
	scheduleClassFlush(classId);
}
