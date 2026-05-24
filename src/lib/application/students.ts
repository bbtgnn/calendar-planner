import { db } from '$lib/db/client';
import * as studentsRepo from '$lib/repos/students.repo';
import { notifyClassDirty } from '$lib/persistence/notify';
import type { ClassId, StudentId, StudentRow } from '$lib/db/types';

export async function addStudent(classId: ClassId, name: string): Promise<StudentRow> {
	const row = await studentsRepo.addStudent(classId, name);
	notifyClassDirty(classId);
	return row;
}

export async function updateStudent(id: StudentId, name: string): Promise<void> {
	const student = await db.students.get(id);
	await studentsRepo.updateStudent(id, name);
	if (student) notifyClassDirty(student.classId);
}

export async function deleteStudentCascade(id: StudentId): Promise<void> {
	const student = await db.students.get(id);
	await studentsRepo.deleteStudentCascade(id);
	if (student) notifyClassDirty(student.classId);
}

export async function replaceStudents(classId: ClassId, names: string[]): Promise<void> {
	await studentsRepo.replaceStudents(classId, names);
	notifyClassDirty(classId);
}

export async function appendStudents(classId: ClassId, names: string[]): Promise<void> {
	await studentsRepo.appendStudents(classId, names);
	notifyClassDirty(classId);
}
