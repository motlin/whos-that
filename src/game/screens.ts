import {levelPoints, type ModeId, type ScoreEntry} from "../shared/scores.ts";
import {BUILD_ALL, BUILD_EASY, buildCount, buildMem, buildOpts, cfg, PLAIN, stage} from "./difficulty.ts";
import {cropBox, FACE_ASPECT, faceSVG, featureBox} from "./draw.ts";
import {diffKeys, type Face, FEATURES, type FeatureKey, HATC, KEYS, makeDecoy, randomFace, visKey} from "./faces.ts";
import {MODES, modeOf} from "./modes.ts";
import {chooseStyle} from "./settings.ts";
import {SFX} from "./sound.ts";
import {currentStyle, isStyleId, STYLES} from "./styles/index.ts";
import {Store} from "./store.ts";
import {$, esc, ls, pick, range, rnd, shuffle} from "./util.ts";

/* ---------- screen + timer helpers ---------- */
const G:
{
	mode: ModeId;
	level: number;
	score: number;
	// The share of this level's memorize time left when the player tapped ready, 0 if the timer ran out.
	memorize: number;
	stops: (() => void)[];
	screen: number;
} =
{
	mode: "classic",
	level: 1,
	score: 0,
	memorize: 0,
	stops: [],
	screen: 0,
};
interface Timer
{
	stop(): void;
	frac(): number;
}
interface Option
{
	f: Face;
	ok: boolean;
	src?: Face;
}
interface GameOverInfo
{
	reason: "wrong" | "time";
	real: Face;
	picked?: Face;
	diffs?: FeatureKey[];
	realLabel?: string;
	pickLabel?: string;
	tap?: [number, number];
}

const target = (e: Event): Element => e.target as Element;

function clearTimers(): void
{
	for (const f of G.stops)
	{
		try
		{
			f();
		}
		catch
		{
			// A stop that throws must not keep the others from running.
		}
	}
	G.stops = [];
}
function later(fn: () => void, ms: number): void
{
	const id = setTimeout(fn, ms);
	G.stops.push(() =>
	{
		clearTimeout(id);
	});
}
function show(html: string, inGame = true): void
{
	clearTimers();
	G.screen++;
	$("#screen").innerHTML = html;
	$("#home").classList.toggle("hide", !inGame);
	window.scrollTo(0, 0);
}
const timerHTML = (): string => `<div class="timer"><div class="fill"></div><div class="num"></div></div>`;
function timer(sec: number, el: HTMLElement | null, onDone: () => void): Timer
{
	const start = performance.now(),
		dur = sec * 1000;
	let last = Math.ceil(sec),
		raf = 0,
		dead = false;
	const step = (now: number): void =>
	{
		if (dead) return;
		const rem = Math.max(0, dur - (now - start));
		if (el)
		{
			el.querySelector<HTMLElement>(".fill")!.style.width = (rem / dur) * 100 + "%";
			el.querySelector(".num")!.textContent = String(Math.ceil(rem / 1000));
			el.classList.toggle("low", rem < 3000);
		}
		const whole = Math.ceil(rem / 1000);
		if (whole < last)
		{
			last = whole;
			if (whole <= 3 && whole > 0) SFX.tick();
		}
		if (rem <= 0)
		{
			dead = true;
			onDone();
			return;
		}
		raf = requestAnimationFrame(step);
	};
	raf = requestAnimationFrame(step);
	const t: Timer =
	{
		stop()
		{
			dead = true;
			cancelAnimationFrame(raf);
		},
		frac()
		{
			return Math.max(0, 1 - (performance.now() - start) / dur);
		},
	};
	G.stops.push(() =>
	{
		t.stop();
	});
	return t;
}
const hud = (): string =>
	`<div class="hud"><span>${modeOf(G.mode).icon} ${modeOf(G.mode).name}</span><span>Level <b>${G.level}</b></span><span>Score <b id="hudScore">${G.score}</b></span></div>`;
function floatText(txt: string, el: Element): void
{
	const r = el.getBoundingClientRect();
	const d = document.createElement("div");
	d.className = "float";
	d.textContent = txt;
	d.style.left = r.left + r.width / 2 + "px";
	d.style.top = r.top + r.height * 0.3 + "px";
	document.body.append(d);
	setTimeout(() =>
	{
		d.remove();
	}, 1300);
}
function layoutGrid(n: number): void
{
	const grid = document.querySelector<HTMLElement>("#grid");
	if (!grid) return;
	const fit = (): void =>
	{
		const W = grid.clientWidth;
		const H = Math.max(240, window.innerHeight - grid.getBoundingClientRect().top - 70);
		const gap = 12,
			R = FACE_ASPECT + 0.06;
		let best =
		{
			cw: 0,
			cols: 1,
		};
		for (let cols = 1; cols <= n; cols++)
		{
			const rows = Math.ceil(n / cols);
			const cw = Math.min((W - gap * (cols - 1)) / cols, (H - gap * (rows - 1)) / rows / R);
			if (cw > best.cw)
				best =
				{
					cw,
					cols,
				};
		}
		grid.style.gridTemplateColumns = `repeat(${best.cols}, ${Math.floor(Math.max(72, Math.min(250, best.cw)))}px)`;
	};
	fit();
	addEventListener("resize", fit);
	G.stops.push(() =>
	{
		removeEventListener("resize", fit);
	});
}

/* ---------- title + boards ---------- */
function updateHero(): void
{
	const h = document.querySelector("#heroFace");
	if (h) h.innerHTML = faceSVG(randomFace());
}
export function titleScreen(): void
{
	show(
		`<h1 class="logo">Who's That?</h1>
 <div class="hero sketch" id="heroFace"></div>
 <p class="tag">Memorize the face. Find the face!</p>
 <div class="modes">${MODES.map((m) => `<button class="mode sketch" data-mode="${m.id}"><span class="mi">${m.icon}</span><span class="mt">${m.name}</span><span class="md">${m.desc}</span></button>`).join("")}</div>
 <div class="row" style="margin-top:20px"><button class="btn" id="hsBtn">🏆 High Scores</button><button class="btn" id="settingsBtn">⚙️ Settings</button></div>`,
		false,
	);
	updateHero();
	const iv = setInterval(updateHero, 1500);
	G.stops.push(() =>
	{
		clearInterval(iv);
	});
	for (const b of document.querySelectorAll<HTMLElement>(".mode"))
	{
		b.onclick = (): void =>
		{
			SFX.click();
			startGame(b.dataset["mode"] as ModeId);
		};
	}
	$("#hsBtn").onclick = (): void =>
	{
		SFX.click();
		boardScreen("classic");
	};
	$("#settingsBtn").onclick = (): void =>
	{
		SFX.click();
		settingsScreen();
	};
}
// One face with a bit of everything, drawn once in each art style so the styles can be compared.
const STYLE_SAMPLE: Face =
{
	...PLAIN,
	hairStyle: 5,
	eyeColor: 1,
	mouth: 1,
	facialHair: 2,
	glasses: 1,
	hat: 1,
	cheeks: 1,
	neckwear: 1,
};
function settingsScreen(): void
{
	const chosen = currentStyle();
	show(
		`<h2 class="prompt">⚙️ Settings</h2>
 <p class="tag">Pick an art style</p>
 <div class="styles">${STYLES.map((st) => `<button class="stylecard${st === chosen ? " on" : ""}" data-style="${st.id}" aria-pressed="${st === chosen}">${faceSVG(STYLE_SAMPLE, {}, st)}<span class="sn">${st.name}</span><span class="sb">${st.blurb}</span></button>`).join("")}</div>
 <div class="row" style="margin-top:20px"><button class="btn primary" id="back">◀ Menu</button></div>`,
		false,
	);
	for (const b of document.querySelectorAll<HTMLElement>(".stylecard"))
	{
		b.onclick = (): void =>
		{
			const id = b.dataset["style"];
			if (!isStyleId(id)) return;
			SFX.click();
			chooseStyle(id);
			settingsScreen();
		};
	}
	$("#back").onclick = (): void =>
	{
		SFX.click();
		titleScreen();
	};
}
function boardRows(list: ScoreEntry[], hiT?: number): string
{
	if (!list.length) return `<div class="empty">No scores yet. Be the first!</div>`;
	const medal = ["🥇", "🥈", "🥉"];
	return list
		.map(
			(e, i) =>
				`<div class="brow${hiT && e.t === hiT ? " me" : ""}"><span class="rk">${medal[i] ?? i + 1}</span><span>${esc(e.n)}</span><span class="lv">Lvl ${e.l}</span><span class="sc">${e.s}</span></div>`,
		)
		.join("");
}
function boardScreen(mode: ModeId, hiT?: number, note?: string | null): void
{
	show(
		`<h2 class="prompt">🏆 High Scores</h2>
 <div class="tabs">${MODES.map((m) => `<button class="tab${m.id === mode ? " on" : ""}" data-m="${m.id}">${m.icon} ${m.name}</button>`).join("")}</div>
 <div class="board sketch" id="boardList"><div class="empty">Loading…</div></div>
 <p class="note" id="boardNote"></p>
 <div class="row"><button class="btn" id="back">◀ Menu</button><button class="btn primary" id="play">Play</button></div>`,
		false,
	);
	const tok = G.screen;
	let all: Record<ModeId, ScoreEntry[]> | null = null,
		cur = mode;
	const draw = (): void =>
	{
		for (const t of document.querySelectorAll<HTMLElement>(".tab"))
			t.classList.toggle("on", t.dataset["m"] === cur);
		$("#play").textContent = "Play " + modeOf(cur).name + " ▶";
		if (all) $("#boardList").innerHTML = boardRows(all[cur], hiT);
	};
	for (const t of document.querySelectorAll<HTMLElement>(".tab"))
	{
		t.onclick = (): void =>
		{
			SFX.click();
			cur = t.dataset["m"] as ModeId;
			draw();
		};
	}
	$("#back").onclick = (): void =>
	{
		SFX.click();
		titleScreen();
	};
	$("#play").onclick = (): void =>
	{
		SFX.click();
		startGame(cur);
	};
	draw();
	void (async (): Promise<void> =>
	{
		const a = await Store.load();
		if (tok !== G.screen) return;
		all = a;
		draw();
		$("#boardNote").textContent =
			note ?? (Store.shared ? "Shared with everyone who plays this game." : "Saved on this device.");
	})();
}

/* ---------- game flow ---------- */
function startGame(mode: ModeId): void
{
	G.mode = mode;
	G.level = 1;
	G.score = 0;
	levelSplash();
}
const FIRST_TIPS: Record<ModeId, string> =
{
	classic: "Memorize the face, then find it!",
	spot: "Memorize the face, then tap what changed!",
	build: "Remember 3 things about this face, then build it back!",
	lineup: "Memorize every face, then find them all!",
};
function tipFor(): string
{
	const L = G.level,
		m = G.mode;
	if (L === 1) return FIRST_TIPS[m];
	const a = cfg(L - 1),
		b = cfg(L),
		t: string[] = [];
	if (m !== "build" && b.mem < a.mem)
		t.push(`Only ${m === "lineup" ? Math.round(b.mem * (L <= 4 ? 2 : 3) * 0.8) : b.mem} seconds to memorize!`);
	if (m === "classic" && b.choices > a.choices) t.push(`Now ${b.choices} faces to choose from!`);
	if ((m === "classic" || m === "lineup") && b.changes < a.changes) t.push("The fakes look more alike now!");
	if (m !== "build" && stage(L) > stage(L - 1)) t.push("Sneakier changes ahead!");
	if (m === "build")
	{
		if (buildCount(L) > buildCount(L - 1)) t.push(`Now ${buildCount(L)} pieces to remember!`);
		else if (buildMem(L) < buildMem(L - 1)) t.push(`Every piece now! Only ${buildMem(L)} seconds to memorize!`);
		if (buildOpts(L) > buildOpts(L - 1)) t.push(`${buildOpts(L)} choices for each piece!`);
	}
	if (m === "lineup" && L === 5) t.push("Now 3 faces to memorize!");
	return t.join(" ") || pick(["You got this!", "Keep going!", "Sharp eyes!", "Nice memory!", "On a roll!"]);
}
const ROUNDS: Record<ModeId, () => void> =
{
	classic: () =>
	{
		classicRound();
	},
	spot: () =>
	{
		spotRound();
	},
	build: () =>
	{
		buildRound();
	},
	lineup: () =>
	{
		lineupRound();
	},
};
function levelSplash(): void
{
	show(`<div class="splash"><div class="lvl">Level ${G.level}</div><div class="sub">${tipFor()}</div></div>`);
	SFX.whoosh();
	later(
		() =>
		{
			ROUNDS[G.mode]();
		},
		G.level === 1 ? 1600 : 1300,
	);
}
function award(frac: number): number
{
	const pts = levelPoints(G.level, frac, G.memorize);
	G.score += pts;
	SFX.ding();
	return pts;
}
function roundWin(frac: number, el: Element): void
{
	const pts = award(frac);
	const s = document.querySelector("#hudScore");
	if (s) s.textContent = String(G.score);
	floatText("+" + pts + (frac > 0.6 ? " Speedy!" : ""), el);
	G.level++;
	later(levelSplash, 1200);
}
function memorizeScreen(faces: Face[], sec: number, next: () => void, msg: string): void
{
	show(`${hud()}<h2 class="prompt">${msg}</h2>
 <div class="memo memo-${faces.length}">${faces.map((f, i) => `<div class="facecard big">${faces.length > 1 ? `<span class="badge">${i + 1}</span>` : ""}${faceSVG(f)}</div>`).join("")}</div>
 ${timerHTML()}<div class="row"><button class="btn primary" id="ready">I'm ready! ▶</button></div>`);
	let done = false;
	const go = (left: number): void =>
	{
		if (done) return;
		done = true;
		G.memorize = left;
		t.stop();
		next();
	};
	const t = timer(sec, $(".timer"), () =>
	{
		go(0);
	});
	$("#ready").onclick = (): void =>
	{
		SFX.click();
		go(t.frac());
	};
}
function choiceScreen(
	opts: Option[],
	sec: number,
	onPick: (i: number, btn: HTMLButtonElement, t: Timer) => "stop" | undefined,
	onTimeout: () => void,
	msg: string,
): void
{
	show(
		`${hud()}<h2 class="prompt">${msg}</h2><div class="grid" id="grid">${opts.map((o, i) => `<button class="facecard pick" data-i="${i}">${faceSVG(o.f)}</button>`).join("")}</div>${timerHTML()}`,
	);
	layoutGrid(opts.length);
	let lock = false;
	const t = timer(sec, $(".timer"), () =>
	{
		lock = true;
		onTimeout();
	});
	$("#grid").onclick = (e): void =>
	{
		const b = target(e).closest<HTMLButtonElement>(".pick");
		if (!b || lock || b.disabled) return;
		const r = onPick(Number(b.dataset["i"]), b, t);
		if (r === "stop")
		{
			lock = true;
			t.stop();
		}
	};
}

function classicRound(): void
{
	const c = cfg(G.level),
		face = randomFace(),
		used = new Set([visKey(face)]);
	memorizeScreen(
		[face],
		c.mem,
		() =>
		{
			const opts = shuffle([
				{
					f: face,
					ok: true,
				},
				...range(c.choices - 1).map(() => (
				{
					f: makeDecoy(face, c.changes, c.pool, used),
					ok: false,
				})),
			]);
			choiceScreen(
				opts,
				c.pick,
				(i, btn, t) =>
				{
					const o = opts[i]!;
					if (o.ok)
					{
						btn.classList.add("right");
						roundWin(t.frac(), btn);
						return "stop";
					}
					gameOver(
						{
							reason: "wrong",
							real: face,
							picked: o.f,
							diffs: diffKeys(face, o.f),
						},
					);
					return "stop";
				},
				() =>
				{
					gameOver(
						{
							reason: "time",
							real: face,
						},
					);
				},
				"Which one is it?",
			);
		},
		"Memorize this face!",
	);
}

interface Category
{
	id: string;
	name: string;
	// Mirrored features (ears, earrings) show one side, so the picture is big enough to read.
	oneSide?: boolean;
	keys: FeatureKey[];
}
const CATS: Category[] = [
	{
		id: "hat",
		name: "Hat",
		keys: ["hat", "hatColor"],
	},
	{
		id: "hair",
		name: "Hair",
		keys: ["hairStyle", "hairColor", "hairDye"],
	},
	{
		id: "brows",
		name: "Eyebrows",
		keys: ["eyebrows"],
	},
	{
		id: "eyes",
		name: "Eyes",
		keys: ["eyes", "eyeColor"],
	},
	{
		id: "glasses",
		name: "Glasses",
		keys: ["glasses"],
	},
	{
		id: "nose",
		name: "Nose",
		keys: ["nose"],
	},
	{
		id: "mouth",
		name: "Mouth",
		keys: ["mouth"],
	},
	{
		id: "ears",
		name: "Ears",
		keys: ["ears"],
		oneSide: true,
	},
	{
		id: "earrings",
		name: "Earrings",
		keys: ["earrings"],
		oneSide: true,
	},
	{
		id: "beard",
		name: "Facial hair",
		keys: ["facialHair"],
	},
	{
		id: "cheeks",
		name: "Cheeks",
		keys: ["cheeks"],
	},
	{
		id: "neck",
		name: "Neckwear",
		keys: ["neckwear"],
	},
	{
		id: "shirt",
		name: "Shirt",
		keys: ["shirt", "shirtStyle"],
	},
	{
		id: "shape",
		name: "Face shape",
		keys: ["faceShape"],
	},
	{
		id: "skin",
		name: "Skin color",
		keys: ["skin"],
	},
];
function spotRound(): void
{
	const L = G.level,
		c = cfg(L),
		face = randomFace();
	const changed = makeDecoy(face, 1, c.pool, new Set([visKey(face)])),
		diffs = diffKeys(face, changed);
	const rightCats = CATS.filter((ct) => ct.keys.some((k) => diffs.includes(k)));
	const nChoices = Math.min(CATS.length, 4 + Math.floor((L - 1) / 2));
	const others = shuffle(CATS.filter((ct) => !rightCats.includes(ct))).slice(0, Math.max(0, nChoices - 1));
	const choices = shuffle([rightCats[0]!, ...others]);
	memorizeScreen(
		[face],
		c.mem,
		() =>
		{
			show(`${hud()}<div class="splash"><div class="looking">👀 Look closely…</div></div>`);
			later(() =>
			{
				show(
					`${hud()}<h2 class="prompt">What changed?</h2><div class="memo spotwrap"><div class="facecard big" id="spotFace">${faceSVG(changed)}</div></div>${timerHTML()}<div class="cats" id="cats">${choices
						.map(
							(ct, i) =>
								`<button class="cat" data-i="${i}">${faceSVG(
									changed,
									{
										vb: featureBox(changed, ct.keys, ct.oneSide),
									},
								)}<span>${ct.name}</span></button>`,
						)
						.join("")}</div>`,
				);
				let lock = false;
				const t = timer(c.pick, $(".timer"), () =>
				{
					lock = true;
					gameOver(
						{
							reason: "time",
							real: face,
							picked: changed,
							diffs,
							realLabel: "Before",
							pickLabel: "After",
						},
					);
				});
				$("#cats").onclick = (e): void =>
				{
					const b = target(e).closest<HTMLElement>(".cat");
					if (!b || lock) return;
					lock = true;
					const fr = t.frac();
					t.stop();
					const ct = choices[Number(b.dataset["i"])]!;
					if (rightCats.includes(ct))
					{
						b.classList.add("right");
						const pts = award(fr);
						later(() =>
						{
							show(`${hud()}<h2 class="prompt" style="color:var(--good)">✓ Yes! The ${ct.name.toLowerCase()} changed!</h2>
      <div class="compare">
       <figure class="facecard big ok">${faceSVG(
			face,
			{
				hl: diffs,
				good: true,
			},
		)}<figcaption>Before</figcaption></figure>
       <figure class="facecard big ok">${faceSVG(
			changed,
			{
				hl: diffs,
				good: true,
			},
		)}<figcaption>After</figcaption></figure>
      </div>
      <p class="diffs">Changed: <b>${diffs.map((k) => FEATURES[k].label).join(", ")}</b></p>
      <div class="row"><button class="btn primary" id="nextLvl">Next level ▶</button></div>`);
							floatText("+" + pts + (fr > 0.6 ? " Speedy!" : ""), $(".compare"));
							$("#nextLvl").onclick = (): void =>
							{
								SFX.click();
								G.level++;
								levelSplash();
							};
						}, 450);
					}
					else
						gameOver(
							{
								reason: "wrong",
								real: face,
								picked: changed,
								diffs,
								realLabel: "Before",
								pickLabel: `After (you picked ${ct.name})`,
							},
						);
				};
			}, 1100);
		},
		"Memorize this face! Something will change…",
	);
}

function buildRound(): void
{
	const L = G.level,
		count = buildCount(L),
		nOpts = buildOpts(L);
	const pool = shuffle((L <= 4 ? BUILD_EASY : BUILD_ALL).slice());
	let keys = pool.slice(0, count);
	if (keys.length < count) keys = keys.concat(shuffle(BUILD_ALL.filter((k) => !keys.includes(k)))).slice(0, count);
	keys.sort((a, b) => KEYS.indexOf(a) - KEYS.indexOf(b));
	const plain: Face =
	{
		...PLAIN,
		hatColor: rnd(HATC.length),
	};
	const face: Face =
	{
		...plain,
	};
	const allowed = (k: FeatureKey): number[] =>
		range(FEATURES[k].n).filter((v) => !(k === "hairStyle" && v === 6 && keys.includes("hat")));
	for (const k of keys) face[k] = pick(allowed(k).filter((v) => v !== plain[k]));
	const options = {} as Record<FeatureKey, number[]>,
		cur: Face =
		{
			...plain,
		};
	for (const k of keys)
	{
		const rest = shuffle(allowed(k).filter((v) => v !== face[k] && v !== plain[k])).slice(
			0,
			Math.max(0, nOpts - 2),
		);
		options[k] = shuffle([face[k], plain[k], ...rest]);
	}
	const total = Math.round(count * Math.max(3.5, 7 - L * 0.2)) + 5;
	const list = keys.map((k) => FEATURES[k].label).join(", ");
	memorizeScreen(
		[face],
		buildMem(L),
		() =>
		{
			show(
				`${hud()}<h2 class="prompt">Build the face!</h2>${timerHTML()}<div class="build"><div class="facecard big" id="bPrev"></div><div class="bpanel"><div class="chips" id="chips"></div><div class="blabel" id="blabel"></div><div class="bopts" id="bopts"></div><div class="row" style="margin:4px 0"><button class="btn primary" id="check" disabled>Check! ✔</button></div></div></div>`,
			);
			const chosen = new Set<FeatureKey>();
			let step = 0,
				lock = false;
			const draw = (): void =>
			{
				$("#bPrev").innerHTML = faceSVG(cur);
				$("#chips").innerHTML = keys
					.map(
						(k, i) =>
							`<button class="chip${i === step ? " on" : ""}${chosen.has(k) ? " done" : ""}" data-i="${i}">${chosen.has(k) ? "✓ " : ""}${FEATURES[k].label}</button>`,
					)
					.join("");
				const k = keys[step]!;
				$("#blabel").textContent = `Pick the ${FEATURES[k].label} (${step + 1} of ${keys.length})`;
				$("#bopts").innerHTML = options[k]
					.map((v) =>
					{
						const ff =
						{
							...cur,
							[k]: v,
						};
						return `<button class="facecard opt${chosen.has(k) && cur[k] === v ? " sel" : ""}" data-v="${v}">${faceSVG(
							ff,
							{
								vb: cropBox(ff, k),
							},
						)}</button>`;
					})
					.join("");
				document.querySelector<HTMLButtonElement>("#check")!.disabled = chosen.size < keys.length;
			};
			const finish = (fr: number | null): void =>
			{
				lock = true;
				const wrong = keys.filter((k) => cur[k] !== face[k]);
				if (!wrong.length && fr !== null)
				{
					roundWin(fr, $("#bPrev"));
					return;
				}
				gameOver(
					{
						reason: fr === null ? "time" : "wrong",
						real: face,
						picked:
						{
							...cur,
						},
						diffs: wrong,
						pickLabel: "Your face",
					},
				);
			};
			$("#chips").onclick = (e): void =>
			{
				const b = target(e).closest<HTMLElement>(".chip");
				if (!b || lock) return;
				SFX.click();
				step = Number(b.dataset["i"]);
				draw();
			};
			$("#bopts").onclick = (e): void =>
			{
				const b = target(e).closest<HTMLElement>(".opt");
				if (!b || lock) return;
				const k = keys[step]!;
				cur[k] = Number(b.dataset["v"]);
				chosen.add(k);
				SFX.pop();
				const nxt = keys.findIndex((kk, i) => i > step && !chosen.has(kk));
				const any = keys.findIndex((kk) => !chosen.has(kk));
				draw();
				if (nxt >= 0 || any >= 0)
				{
					later(() =>
					{
						if (lock) return;
						step = nxt >= 0 ? nxt : any;
						draw();
					}, 260);
				}
			};
			const t = timer(total, $(".timer"), () =>
			{
				finish(null);
			});
			$("#check").onclick = (): void =>
			{
				if (lock) return;
				const fr = t.frac();
				t.stop();
				finish(fr);
			};
			draw();
		},
		`Remember these ${count}: ${list}`,
	);
}

function lineupRound(): void
{
	const L = G.level,
		c = cfg(L),
		nT = L <= 4 ? 2 : 3,
		total = Math.min(9, nT + 2 + Math.floor((L - 1) / 2)),
		mem = Math.round(c.mem * nT * 0.8);
	const used = new Set<string>(),
		targets: Face[] = [];
	while (targets.length < nT)
	{
		const f = randomFace(),
			k = visKey(f);
		if (!used.has(k))
		{
			used.add(k);
			targets.push(f);
		}
	}
	const decoys = range(total - nT).map((i) =>
	{
		const src = targets[i % nT]!;
		return {
			f: makeDecoy(src, c.changes, c.pool, used),
			ok: false,
			src,
		};
	});
	const opts: Option[] = shuffle([
		...targets.map((f) => (
		{
			f,
			ok: true,
			src: f,
		})),
		...decoys,
	]);
	memorizeScreen(
		targets,
		mem,
		() =>
		{
			const found = new Set<Face>();
			choiceScreen(
				opts,
				c.pick + 3 * nT,
				(i, btn, t) =>
				{
					const o = opts[i]!;
					if (o.ok)
					{
						btn.disabled = true;
						btn.classList.add("found");
						found.add(o.f);
						if (found.size === nT)
						{
							roundWin(t.frac(), btn);
							return "stop";
						}
						SFX.pop();
						return undefined;
					}
					gameOver(
						{
							reason: "wrong",
							real: o.src!,
							picked: o.f,
							diffs: diffKeys(o.src!, o.f),
							realLabel: "The real face",
						},
					);
					return "stop";
				},
				() =>
				{
					const miss = targets.find((f) => !found.has(f))!;
					gameOver(
						{
							reason: "time",
							real: miss,
							realLabel: "You missed this one",
						},
					);
				},
				`Find all ${nT} faces!`,
			);
		},
		`Memorize these ${nT} faces!`,
	);
}

function gameOver(info: GameOverInfo): void
{
	SFX.buzz();
	const labels = info.diffs?.length ? info.diffs.map((k) => FEATURES[k].label) : [];
	show(`${hud()}<h2 class="prompt bad">${info.reason === "time" ? "⏰ Time's up!" : "Oops! Not quite."}</h2>
 <div class="compare">
  <figure class="facecard big ok">${faceSVG(
		info.real,
		{
			hl: info.picked ? info.diffs : null,
		},
  )}<figcaption>${info.realLabel ?? "The real face"}</figcaption></figure>
  ${
		info.picked
			? `<figure class="facecard big wrong">${faceSVG(
					info.picked,
					{
						hl: info.diffs,
						mark: info.tap,
					},
				)}<figcaption>${info.pickLabel ?? "Your pick"}</figcaption></figure>`
			: ""
  }
 </div>
 ${labels.length ? `<p class="diffs">Different: <b>${labels.join(", ")}</b></p>` : ""}
 <div class="final sketch"><div>Final score</div><div class="bigscore">${G.score}</div><div>You reached level ${G.level}</div>
 <div class="hs-area" id="hsArea">Checking high scores…</div>
 <div class="row"><button class="btn primary" id="again">Play again ↻</button><button class="btn" id="menu">Menu</button><button class="btn" id="seeHs">🏆</button></div></div>`);
	$("#again").onclick = (): void =>
	{
		SFX.click();
		startGame(G.mode);
	};
	$("#menu").onclick = (): void =>
	{
		SFX.click();
		titleScreen();
	};
	$("#seeHs").onclick = (): void =>
	{
		SFX.click();
		boardScreen(G.mode);
	};
	const tok = G.screen;
	void (async (): Promise<void> =>
	{
		const all = await Store.load();
		if (tok !== G.screen) return;
		const area = $("#hsArea"),
			list = all[G.mode];
		const qual = G.score > 0 && (list.length < 10 || G.score > list.at(-1)!.s);
		if (!qual)
		{
			area.innerHTML =
				G.score === 0 ? "Keep practicing!" : `Top 10 needs <b>${list.at(-1)!.s + 1}</b> points. So close!`;
			return;
		}
		area.innerHTML = `<div class="newhs">🌟 You made the Top 10! 🌟</div><div class="nameRow"><input id="nm" maxlength="12" placeholder="Your name" autocomplete="off"><button class="btn primary" id="saveHs">Save</button></div>`;
		SFX.fanfare();
		const inp = document.querySelector<HTMLInputElement>("#nm")!;
		inp.value = ls.get("wt_name") ?? "";
		let saving = false;
		const save = async (): Promise<void> =>
		{
			if (saving) return;
			saving = true;
			const n = (inp.value.trim().replace(/\s+/g, " ") || "Player").slice(0, 12);
			ls.set("wt_name", n);
			const btn = document.querySelector<HTMLButtonElement>("#saveHs")!;
			btn.disabled = true;
			btn.textContent = "Saving…";
			const entry: ScoreEntry =
			{
				n,
				s: G.score,
				l: G.level,
				t: Date.now(),
			};
			const saved = await Store.save(G.mode, entry);
			if (tok !== G.screen) return;
			boardScreen(
				G.mode,
				saved.t,
				saved.ok ? null : "Couldn't reach the shared board, so this score was saved on this device.",
			);
		};
		$("#saveHs").onclick = (): void =>
		{
			void save();
		};
		inp.onkeydown = (e): void =>
		{
			if (e.key === "Enter") void save();
		};
	})();
}

export function initHome(): void
{
	$("#home").onclick = (): void =>
	{
		SFX.click();
		titleScreen();
	};
}
