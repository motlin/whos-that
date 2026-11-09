import type {ModeId} from "../shared/scores.ts";

export interface Mode
{
	id: ModeId;
	name: string;
	icon: string;
	desc: string;
}

export const MODES: Mode[] = [
	{
		id: "classic",
		name: "Classic",
		icon: "🎯",
		desc: "Memorize a face, then pick it out of the lineup.",
	},
	{
		id: "spot",
		name: "Spot the Difference",
		icon: "🔍",
		desc: "The face comes back with something changed. Tap it!",
	},
	{
		id: "build",
		name: "Build It",
		icon: "✏️",
		desc: "Memorize what makes the face special, then build it back piece by piece.",
	},
	{
		id: "lineup",
		name: "Lineup",
		icon: "👥",
		desc: "Memorize 2 or 3 faces, then find every one.",
	},
];
export const modeOf = (id: ModeId): Mode => MODES.find((m) => m.id === id)!;
