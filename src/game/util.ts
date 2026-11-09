export const $ = (s: string): HTMLElement => document.querySelector<HTMLElement>(s)!;
export const rnd = (n: number): number => Math.floor(Math.random() * n);
export const pick = <T>(a: readonly T[]): T => a[rnd(a.length)] as T;
export const shuffle = <T>(a: T[]): T[] =>
{
	for (let i = a.length - 1; i > 0; i--)
	{
		const j = rnd(i + 1);
		[a[i], a[j]] = [a[j] as T, a[i] as T];
	}
	return a;
};
export const range = (n: number): number[] => [...Array(n).keys()];
const ESCAPES: Record<string, string> =
{
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
	"'": "&#39;",
};
export const esc = (s: unknown): string => String(s).replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);
export const ls =
{
	get(k: string): string | null
	{
		try
		{
			return localStorage.getItem(k);
		}
		catch
		{
			return null;
		}
	},
	set(k: string, v: string): void
	{
		try
		{
			localStorage.setItem(k, v);
		}
		catch
		{
			// Storage is unavailable, so the value is not kept.
		}
	},
};
