let message = $state<string | null>(null);
let hideTimer: ReturnType<typeof setTimeout> | undefined;

export function getToastMessage(): string | null {
	return message;
}

export function showToast(text: string, ms = 4000): void {
	message = text;
	if (hideTimer) clearTimeout(hideTimer);
	hideTimer = setTimeout(() => {
		message = null;
	}, ms);
}
