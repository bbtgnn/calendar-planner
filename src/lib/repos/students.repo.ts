import { db } from '$lib/db/client';
import type { ClassId, StudentId, StudentRow } from '$lib/db/types';

export async function listStudents(classId: ClassId): Promise<StudentRow[]> {
	const rows = await db.students.where('classId').equals(classId).toArray();
	rows.sort((a, b) => a.name.localeCompare(b.name));
	return rows;
}

export async function addStudent(classId: ClassId, name: string): Promise<StudentRow> {
	const row: StudentRow = { id: crypto.randomUUID(), classId, name };
	await db.students.add(row);
	return row;
}

export async function updateStudent(id: StudentId, name: string): Promise<void> {
	await db.students.update(id, { name });
}

export async function deleteStudentCascade(id: StudentId): Promise<void> {
	await db.transaction('rw', db.students, db.absences, async () => {
		await db.absences.where('studentId').equals(id).delete();
		await db.students.delete(id);
	});
}

export async function replaceStudents(classId: ClassId, names: string[]): Promise<void> {
	await db.transaction('rw', db.students, db.absences, async () => {
		const existing = await db.students.where('classId').equals(classId).toArray();
		for (const s of existing) {
			await db.absences.where('studentId').equals(s.id).delete();
		}
		await db.students.where('classId').equals(classId).delete();
		for (const name of names) {
			await db.students.add({ id: crypto.randomUUID(), classId, name });
		}
	});
}

export async function appendStudents(classId: ClassId, names: string[]): Promise<void> {
	for (const name of names) {
		await db.students.add({ id: crypto.randomUUID(), classId, name });
	}
}
