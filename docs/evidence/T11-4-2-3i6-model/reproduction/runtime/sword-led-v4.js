import { d as e, l as t, p as n, r, u as i } from "./core-CvAZnNjA.js";
import { d as a, i as o, s, t as c, u as l } from "./browser-session-BQdQqpuu.js";
import { n as u } from "./rules-CAo3EZyg.js";
//#region src/core-v4/content.ts
var d = Object.freeze([
	"steady",
	"ember",
	"inherit",
	"echo",
	"crackedEdge",
	"pardon"
]), f = Object.freeze([
	"light",
	"guard",
	"heavy"
]), p = Object.freeze([
	"windbox",
	"warmRack",
	"wideMouth"
]), m = Object.freeze([
	"donation",
	"loan",
	"salvage",
	"credit",
	"shelter",
	"rest"
]), h = n({
	light: {
		name: "轻刃",
		success: 155,
		great: 210,
		greatOdds: 150,
		cracks: [
			80,
			120,
			180,
			260,
			340,
			420,
			500,
			550,
			600
		]
	},
	guard: {
		name: "护刃",
		success: 140,
		great: 195,
		greatOdds: 150,
		cracks: [
			30,
			50,
			80,
			120,
			180,
			240,
			320,
			400,
			480
		]
	},
	heavy: {
		name: "重锋",
		success: 145,
		great: 240,
		greatOdds: 200,
		cracks: [
			60,
			100,
			150,
			220,
			300,
			380,
			460,
			540,
			600
		]
	}
}), g = n({
	windbox: {
		name: "风箱",
		text: "每柄首次普通大成，额外增加10%身价；从下一天起生效。"
	},
	warmRack: {
		name: "余温架",
		text: "唯一留剑跨天增加15%身价，裂纹和锤势原样保留。"
	},
	wideMouth: {
		name: "宽口炉",
		text: "每柄第一次安全连锻多一记，可与炉心余烬叠加。"
	}
}), _ = n([
	{
		id: 1,
		title: "第一章 · 灯从炉起",
		days: [1, 4],
		base: 40,
		opening: "山路第一盏灯熄了。阿岚把旧巡剑放到铁砧旁：先让巡夜的人回家。",
		letter: "阿禾捎来第一封信：驿路有人等灯，也有人等一把好剑。",
		success: "渡口亮起第一列灯，巡守与信使终于能在桥头碰面。",
		failure: "渡口还没有完全守住。你带着未完成的委托继续上路，炉火仍在。"
	},
	{
		id: 2,
		title: "第二章 · 风雪同行",
		days: [5, 8],
		base: 80,
		opening: "山路渐陡。留下的旧剑、新学的手艺，都要在风雪里派上用场。",
		letter: "杜伯说，裂纹也能记住炉火。阿禾却要两柄轻剑，分给两条驿路。",
		success: "双驿的灯先后回应，雪中的救援队看见了归路。",
		failure: "双驿仍有一条路未通。已救回的人与遗憾，都记在这本炉谱里。"
	},
	{
		id: 3,
		title: "第三章 · 山口守灯",
		days: [9, 12],
		base: 160,
		opening: "最后一位商人在山口等候。决定带上什么，再锻最后几炉。",
		letter: "阿岚守着缺口，阿禾赶来接力。杜伯等一柄真正能留名的护灯剑。",
		success: "护灯剑送到山口，三人的灯火终于相连。",
		failure: "山口仍有未完成的事。好剑与遗憾会一同陪你归来。"
	}
]), v = n([
	{
		day: 3,
		upgrade: 180,
		repair: 150,
		pool: [
			"steady",
			"ember",
			"echo"
		]
	},
	{
		day: 6,
		upgrade: 700,
		repair: 350,
		pool: [
			"inherit",
			"crackedEdge",
			"pardon"
		]
	},
	{
		day: 9,
		upgrade: 1600,
		repair: 800,
		pool: [
			"steady",
			"ember",
			"inherit",
			"echo",
			"crackedEdge",
			"pardon"
		]
	}
]), y = n({
	donation: {
		name: "护送捐剑",
		request: "巡守愿替你护送下一批铁料，代价是一柄现在能带走的剑。",
		cost: [
			0,
			0,
			0
		],
		piece: "active",
		result: "这柄剑交给护送队。下一天的三个铁坯底价增加20%。"
	},
	loan: {
		name: "借锤",
		request: "杜伯愿借出老锤。付60金币，让明天第一柄前三记普通锤的正收益额多10%。",
		cost: [
			60,
			60,
			60
		],
		piece: "none",
		result: "借锤的钱已记清，明日第一柄会带上这份手感。"
	},
	salvage: {
		name: "旧刃回收",
		request: "行商愿用160金币换走架上的旧剑。交出去，就没有这柄旧剑可作下一轮委托。",
		cost: [
			0,
			0,
			0
		],
		piece: "reserve",
		result: "160金币入袋，旧剑离开剑架，不再兼作交差或保险。"
	},
	credit: {
		name: "商人赊护",
		request: "付清护炉钱，下一次完好剑出现裂纹时保住身价；再次裂损仍会断。",
		cost: [
			90,
			180,
			360
		],
		piece: "none",
		result: "保价资格已备好。下一次首次裂损会消耗，不会恢复断剑。"
	},
	shelter: {
		name: "雨夜修棚",
		request: "花80金币修好炉棚，明天第一柄在当天的裂损率降低3个百分点。",
		cost: [
			80,
			80,
			80
		],
		piece: "none",
		result: "炉棚补好了。明天第一柄能少受一点风雨，之后不再额外生效。"
	},
	rest: {
		name: "守炉",
		request: "今夜不添交易。守着炉火，保留眼前的剑与金币。",
		cost: [
			0,
			0,
			0
		],
		piece: "none",
		result: "没有额外得失，这一炉的选择原样保留。"
	}
}), b = n([
	{
		id: 1,
		title: "巡夜第一灯",
		customer: "guard",
		name: "阿岚",
		request: "巡夜的人要一柄无裂新剑，先点亮归家的第一站。",
		success: "阿岚点亮第一座灯站，巡夜的人看见了家门。",
		failure: "第一站还在等可靠的新剑。",
		scene: "night-watch",
		routes: [{
			id: "intact",
			count: 1,
			value: 100,
			crack: "intact"
		}]
	},
	{
		id: 2,
		title: "重开驿路",
		customer: "courier",
		name: "阿禾",
		request: "四记普通锤内的无裂轻刃，跑山路才轻快。",
		success: "阿禾带轻刃穿过驿路，第一封信准时送达。",
		failure: "驿路还没有等到轻快的剑。",
		scene: "courier-road",
		routes: [{
			id: "light",
			count: 1,
			value: 160,
			recipe: "light",
			crack: "intact",
			maxHits: 4
		}]
	},
	{
		id: 3,
		title: "修炉试锋",
		customer: "smith",
		name: "杜伯",
		request: "让一柄剑经历一次安全连锻，看看这座炉的火候。",
		success: "杜伯听过成品的回响，替你重新接好了炉火。",
		failure: "这次还没有交出连锻的成品。",
		scene: "rekindle",
		routes: [{
			id: "burst",
			count: 1,
			value: 260,
			minBursts: 1
		}]
	},
	{
		id: 4,
		title: "守住渡口",
		customer: "guard",
		name: "阿岚",
		request: "渡口需要一柄无裂护刃，守住来往的人。",
		success: "护刃送上桥头，渡口恢复了巡守。",
		failure: "渡口仍有缺口，阿岚把未竟的事记在纸上。",
		scene: "bridge",
		routes: [{
			id: "guard",
			count: 1,
			value: 360,
			recipe: "guard",
			crack: "intact"
		}]
	},
	{
		id: 5,
		title: "故剑归程",
		customer: "courier",
		name: "阿禾",
		request: "带一柄昨日留下的旧剑；若没有，就用更好的新剑接替。",
		success: "一柄剑接住了前一程的约定，阿禾又能赶路。",
		failure: "这一程的旧剑与新剑都还差一点。",
		scene: "returning-blade",
		routes: [{
			id: "old",
			count: 1,
			value: 420,
			age: "old"
		}, {
			id: "new",
			count: 1,
			value: 630,
			age: "new"
		}]
	},
	{
		id: 6,
		title: "逆火修行",
		customer: "smith",
		name: "杜伯",
		request: "带裂纹也能成器，锻一柄有故事的剑。",
		success: "杜伯接过裂剑：它记得你何时肯收手。",
		failure: "裂纹的手艺还需下一炉。",
		scene: "cracked-work",
		routes: [{
			id: "cracked",
			count: 1,
			value: 520,
			crack: "cracked"
		}]
	},
	{
		id: 7,
		title: "救援重锋",
		customer: "guard",
		name: "阿岚",
		request: "救援队要重锋，劈开山路上的阻碍。",
		success: "重锋开出救援道，山里的灯又亮了一站。",
		failure: "救援道还没有完全打开。",
		scene: "rescue",
		routes: [{
			id: "heavy",
			count: 1,
			value: 760,
			recipe: "heavy"
		}]
	},
	{
		id: 8,
		title: "风雪双驿",
		customer: "courier",
		name: "阿禾",
		request: "两条驿路，两柄各自合格的无裂轻刃。",
		success: "两柄轻刃分赴双驿，雪中的灯彼此回应。",
		failure: "双驿尚未全部接通，不能把一柄剑算作两柄。",
		scene: "twin-stations",
		routes: [{
			id: "two-light",
			count: 2,
			value: 420,
			recipe: "light",
			crack: "intact"
		}]
	},
	{
		id: 9,
		title: "炉火回响",
		customer: "smith",
		name: "杜伯",
		request: "让一柄剑经历两次安全连锻，再听一次炉火回响。",
		success: "两次连锻的锻纹交在一起，杜伯记下了这门手艺。",
		failure: "两次炉火的成品还未交出。",
		scene: "double-fire",
		routes: [{
			id: "two-bursts",
			count: 1,
			value: 1e3,
			minBursts: 2
		}]
	},
	{
		id: 10,
		title: "缺口之剑",
		customer: "guard",
		name: "阿岚",
		request: "带裂护刃也可守缺口，或用更高身价的完好护刃。",
		success: "阿岚把护刃举在缺口前，身后的人继续前行。",
		failure: "缺口尚未补上，这次的风险与收手都留在记录中。",
		scene: "mountain-gap",
		routes: [{
			id: "cracked",
			count: 1,
			value: 1150,
			recipe: "guard",
			crack: "cracked"
		}, {
			id: "intact",
			count: 1,
			value: 1800,
			recipe: "guard",
			crack: "intact"
		}]
	},
	{
		id: 11,
		title: "最后的接力",
		customer: "courier",
		name: "阿禾",
		request: "一柄同行的旧剑，或两柄新剑，接完最后一程。",
		success: "阿禾把剑交到接力的人手里，山口已在眼前。",
		failure: "接力还缺最后的一柄，归程也会记住这件事。",
		scene: "relay",
		routes: [{
			id: "old",
			count: 1,
			value: 1300,
			age: "old"
		}, {
			id: "two-new",
			count: 2,
			value: 850,
			age: "new"
		}]
	},
	{
		id: 12,
		title: "山口护灯",
		customer: "smith",
		name: "杜伯",
		request: "无裂名器重锋，送到山口，护住最后的灯。",
		success: "护灯剑送到山口，三人抬头看见了相连的灯火。",
		failure: "护灯剑还没有完成，不能说十二灯已经复明。",
		scene: "last-lantern",
		routes: [{
			id: "finale",
			count: 1,
			value: 2500,
			recipe: "heavy",
			crack: "intact",
			minLevel: 9
		}]
	}
]), x = n({
	victory: {
		title: "十二灯复明",
		text: "关键的剑都送到了，十二站的灯在归路上依次亮起。"
	},
	return: {
		title: "灯下归途",
		text: "炉火还在，有些约定仍未完成。带着这次的作品与手艺再上路。"
	},
	defeat: {
		title: "炉火暂熄",
		text: "契约印记用尽了。已经做成的作品与学会的炉谱会留下。"
	}
}), S = 1e9, C = 99, w = 1900, T = 2048, E = (e) => e <= 4 ? 1 : e <= 8 ? 2 : 3, D = (e) => Math.floor(e.base / 4), O = (e) => e.value >= 1e9 || e.level >= 99, k = (e, t) => Math.min(S, Math.floor(e * t / 100));
function ee(e, t, n) {
	return Math.floor(_[E(t) - 1].base * 3 ** e.upgradeCount / 2 ** e.upgradeCount * n / 100);
}
function A(e) {
	return b[e.commissionOrder[e.day - 1] - 1];
}
function j(e) {
	let t = new Set(e.initialEligibility.recipes);
	e.history.some((e) => e.day === 4 && e.sealsAfter > 0) && t.add("guard"), e.history.some((e) => e.day === 8 && e.sealsAfter > 0) && t.add("heavy");
	for (let n of A(e).routes) n.recipe && t.add(n.recipe);
	return [
		"light",
		"guard",
		"heavy"
	].filter((e) => t.has(e));
}
function te(e) {
	return A(e).routes.find((e) => e.recipe)?.recipe || (j(e).includes("guard") ? "guard" : "light");
}
function ne(e, t) {
	let n = h[t.recipe], r = e.dayBuffs.shelter && t.suppliedDay === e.day && t.slot === 1, i = Math.max(0, (t.hits < 3 ? 0 : n.cracks[Math.min(t.hits - 3, 8)]) - (r ? 30 : 0)), a = t.charge === 6, o = a ? 350 : n.greatOdds + (t.cracked && e.traits.includes("crackedEdge") ? 100 : 0);
	return {
		burst: a,
		crack: a ? 0 : i,
		great: o,
		success: 1e3 - o - (a ? 0 : i),
		afterBurstCrack: i
	};
}
function M(e, t, n) {
	let r = [];
	return n.recipe && t.recipe !== n.recipe && r.push(`需要${h[n.recipe].name}`), n.crack === "intact" && t.cracked && r.push("需要无裂纹"), n.crack === "cracked" && !t.cracked && r.push("需要带裂纹"), n.age === "old" && t.suppliedDay >= e.day && r.push("需要昨日留下的旧剑"), n.age === "new" && t.suppliedDay !== e.day && r.push("需要本日新剑"), n.maxHits !== void 0 && t.hits > n.maxHits && r.push(`普通锤不得超过${n.maxHits}次`), n.minLevel !== void 0 && t.level < n.minLevel && r.push(`需要等级${n.minLevel}`), n.minBursts !== void 0 && t.bursts < n.minBursts && r.push(`需要${n.minBursts}次连锻`), t.value < n.value && r.push(`还差${n.value - t.value}身价`), {
		matches: r.length === 0,
		missing: r
	};
}
function N(e) {
	let t = A(e), n = e.blades.filter((n) => n.status === "commissioned" && n.commissionId === t.id && n.finalizedDay === e.day), r = new Map(e.journal.flatMap((e, t) => e.type === "deliver" ? [[e.pieceId, t]] : []));
	n.sort((e, t) => (r.get(e.id) ?? 2 ** 53 - 1) - (r.get(t.id) ?? 2 ** 53 - 1));
	let i = t.routes.map((t) => {
		let r = n.filter((n) => M(e, n, t).matches).map((e) => e.id);
		return {
			id: t.id,
			required: t.count,
			count: r.length,
			pieceIds: r,
			complete: r.length >= t.count
		};
	}), a = i.find((e) => e.complete);
	return {
		commissionId: t.id,
		complete: !!a,
		routeId: a?.id ?? null,
		pieceIds: a?.pieceIds.slice(0, a.required) ?? [],
		routes: i
	};
}
function P(e, t) {
	let n = A(e).routes.map((n) => ({
		id: n.id,
		...M(e, t, n)
	}));
	return {
		canDeliver: e.phase === "workshop" && t.status === "active" && t.id !== e.reserveId,
		qualifies: n.some((e) => e.matches),
		routes: n
	};
}
function re(e) {
	let t = e.blades.filter((t) => t.status === "active" && t.id !== e.reserveId), n = N(e), r = !n.complete && e.traits.includes("pardon") && !e.pardonUsed;
	return {
		...n,
		remaining: t,
		recovered: t.reduce((e, t) => e + D(t), 0),
		protected: r,
		sealsAfter: e.seals - (n.complete || r ? 0 : 1)
	};
}
var F = (e) => v.find((t) => t.day === e.day) ?? null, I = (e) => e.phase === "workshop" && F(e) !== null;
function L(e, t) {
	let n = e.eventId ? y[e.eventId] : null, r = n?.cost[E(e.day) - 1] ?? 0, i = null;
	if (e.phase !== "workshop" || e.eventStatus !== "available" || !n) i = "unavailable";
	else if (e.coins < r) i = "insufficient_coins";
	else if (e.eventId === "credit" && e.crackGuard) i = "already_owned";
	else if (n.piece !== "none") {
		let r = e.blades.find((e) => e.id === t);
		(!r || r.status !== "active" || (n.piece === "reserve" ? e.reserveId !== r.id : e.reserveId === r.id)) && (i = "piece_unavailable");
	} else t !== void 0 && (i = "invalid_command");
	return {
		eventId: e.eventId,
		cost: r,
		requiresPiece: n?.piece ?? "none",
		allowed: i === null,
		error: i
	};
}
//#endregion
//#region src/core-v4/game.ts
var R = (e) => structuredClone(e), z = (e, t) => ({
	ok: !1,
	state: e,
	error: t,
	events: []
}), ie = () => ({
	supplyPct: 100,
	loan: !1,
	shelter: !1
}), B = (e, t) => typeof e == "string" && t.some((t) => t === e), V = (e, t) => Object.keys(e).sort().join(",") === [...t].sort().join(",");
function H(e, t, n) {
	let r = i(e.rng[t]);
	return e.rng[t] = r.stream, Math.floor(r.value * n);
}
function ae(e, t, n) {
	let r = [...n];
	for (let n = r.length - 1; n > 0; n--) {
		let i = H(e, t, n + 1);
		[r[n], r[i]] = [r[i], r[n]];
	}
	return r;
}
function oe(e) {
	e.supplyBase = ee(e, e.day, e.dayBuffs.supplyPct);
	let t = Math.min(e.supplyBase * 4, e.inheritance), n = te(e);
	e.inheritance = 0;
	for (let r = 1; r <= 3; r++) {
		let i = e.supplyBase + (r === 1 ? t : 0);
		e.blades.push({
			id: `d${e.day}-${r}`,
			slot: r,
			suppliedDay: e.day,
			recipe: n,
			status: "active",
			base: i,
			value: i,
			peak: i,
			level: 0,
			cracked: !1,
			hits: 0,
			charge: 0,
			successes: 0,
			normalGreats: 0,
			bursts: 0,
			finalizedDay: null,
			commissionId: null
		});
	}
	e.shop = [], e.sold = [], e.upgraded = !1, e.repaired = !1;
	let r = v.find((t) => t.day === e.day);
	if (r) {
		let t = r.pool.filter((t) => !e.traits.includes(t));
		for (; t.length && e.shop.length < 2;) e.shop.push(t.splice(H(e, "shop", t.length), 1)[0]);
	}
	let i = [
		3,
		5,
		7,
		9,
		11
	].indexOf(e.day);
	e.eventId = i < 0 ? null : e.eventDeck[i], e.eventStatus = e.eventId ? "available" : "none";
}
function U(i) {
	let a = r(i);
	if (!a) return {
		ok: !1,
		error: "invalid_command"
	};
	let o = JSON.parse(a);
	if (!e(o)) return {
		ok: !1,
		error: "invalid_command"
	};
	if (typeof o.runId != "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(o.runId)) return {
		ok: !1,
		error: "invalid_run_id"
	};
	if (typeof o.seed != "string") return {
		ok: !1,
		error: "invalid_seed"
	};
	let s = o.seed.normalize("NFC").trim();
	if (!s || Array.from(s).length > 64) return {
		ok: !1,
		error: "invalid_seed"
	};
	if (o.mode !== void 0 && o.mode !== "story" && o.mode !== "challenge" || !V(o, [
		"runId",
		"seed",
		...o.mode === void 0 ? [] : ["mode"],
		...o.eligibility === void 0 ? [] : ["eligibility"]
	])) return {
		ok: !1,
		error: "invalid_command"
	};
	let c = {
		recipes: ["light"],
		challenge: !1
	};
	if (o.eligibility !== void 0) {
		let t = o.eligibility;
		if (!e(t) || !V(t, ["recipes", "challenge"]) || !Array.isArray(t.recipes) || t.recipes.length > 3 || !t.recipes.every((e) => B(e, f)) || typeof t.challenge != "boolean") return {
			ok: !1,
			error: "invalid_command"
		};
		let n = t.recipes;
		c = {
			recipes: f.filter((e) => e === "light" || t.challenge || n.includes(e)),
			challenge: t.challenge
		};
	}
	if (o.mode === "challenge" && !c.challenge) return {
		ok: !1,
		error: "challenge_locked"
	};
	let l = (e) => ({
		state: t(`${s}|v4|${e}`),
		draws: 0
	}), u = {
		rulesVersion: "forge-v4",
		runId: o.runId,
		seed: s,
		mode: o.mode ?? "story",
		initialEligibility: R(c),
		revision: 0,
		phase: "opening",
		day: 1,
		commissionOrder: Array.from({ length: 12 }, (e, t) => t + 1),
		coins: 0,
		seals: 3,
		supplyBase: 40,
		upgradeCount: 0,
		inheritance: 0,
		blades: [],
		reserveId: null,
		daySales: 0,
		dayRecovered: 0,
		traits: [],
		gift: "locked",
		pardonUsed: !1,
		crackGuard: !1,
		modifications: [],
		chapterChoices: [],
		shop: [],
		sold: [],
		upgraded: !1,
		repaired: !1,
		dayBuffs: R(ie()),
		pending: R(ie()),
		eventDeck: [],
		eventId: null,
		eventStatus: "none",
		eventHistory: [],
		history: [],
		rng: {
			forge: l("forge"),
			shop: l("shop"),
			events: l("events"),
			content: l("content")
		},
		journal: []
	};
	if (u.eventDeck = ae(u, "events", m), u.mode === "challenge") for (let e of [[
		5,
		6,
		7
	], [
		9,
		10,
		11
	]]) {
		let t = ae(u, "content", e);
		for (let n = 0; n < e.length; n++) u.commissionOrder[e[n] - 1] = t[n];
	}
	return oe(u), n({
		ok: !0,
		state: u
	});
}
function se(t) {
	if (!e(t)) return null;
	let n = typeof t.pieceId == "string" && t.pieceId.length <= 32;
	switch (t.type) {
		case "continue":
		case "upgrade":
		case "repair":
		case "settle":
		case "advance": return V(t, ["type"]) ? { type: t.type } : null;
		case "strike":
		case "deliver":
		case "scrap":
		case "reserve": return n && V(t, ["type", "pieceId"]) ? {
			type: t.type,
			pieceId: t.pieceId
		} : null;
		case "setRecipe": return n && B(t.recipe, f) && V(t, [
			"type",
			"pieceId",
			"recipe"
		]) ? {
			type: t.type,
			pieceId: t.pieceId,
			recipe: t.recipe
		} : null;
		case "chooseModification": return B(t.modification, p) && V(t, ["type", "modification"]) ? {
			type: t.type,
			modification: t.modification
		} : null;
		case "chooseEvent": return (t.choice === "accept" || t.choice === "decline") && (t.pieceId === void 0 || n) && V(t, [
			"type",
			"choice",
			...t.pieceId === void 0 ? [] : ["pieceId"]
		]) ? {
			type: t.type,
			choice: t.choice,
			...t.pieceId === void 0 ? {} : { pieceId: t.pieceId }
		} : null;
		case "buy":
		case "claimGift": return t.type === "buy" && !n || !B(t.traitId, d) && (t.type !== "claimGift" || t.traitId !== null) || t.replaceId !== void 0 && !B(t.replaceId, d) || !V(t, [
			"type",
			"traitId",
			...t.type === "buy" ? ["pieceId"] : [],
			...t.replaceId === void 0 ? [] : ["replaceId"]
		]) ? null : t;
		default: return null;
	}
}
function ce(e, t, n) {
	if (e.traits.includes(t)) return "already_owned";
	if (e.traits.length === 3) {
		if (!n || !e.traits.includes(n)) return "invalid_replacement";
		e.traits.splice(e.traits.indexOf(n), 1);
	} else if (n !== void 0) return "invalid_replacement";
	return e.traits.push(t), null;
}
function le(e, t, n) {
	let r = ne(e, t), i = H(e, "forge", 1e3), a = t.value, o = [], s = i < (n ? 350 : r.great) ? "great" : !n && i < r.great + r.crack ? "crack" : "success";
	if (n || t.hits++, !n && e.dayBuffs.shelter && t.slot === 1 && t.suppliedDay === e.day && o.push("shelter"), s === "crack") {
		if (t.cracked) {
			s = "broken", t.value = 0, t.status = "broken", t.finalizedDay = e.day;
			let n = D(t);
			e.coins += n, e.dayRecovered += n, e.traits.includes("inherit") && (e.inheritance += Math.floor(t.peak / 5), o.push("inherit"));
		} else {
			t.cracked = !0;
			let n = e.traits.includes("steady"), r = e.crackGuard;
			n && o.push("steady"), r && (o.push("credit"), e.crackGuard = !1), !n && !r && (t.value = k(t.value, 80));
		}
	} else {
		let r = h[t.recipe];
		t.value = k(t.value, s === "great" ? r.great : r.success), t.level = Math.min(99, t.level + (s === "great" ? 2 : 1)), n || (s === "great" && (t.normalGreats === 0 && e.modifications.includes("windbox") && (t.value = k(t.value, 110), o.push("windbox")), t.normalGreats++), t.successes++, e.traits.includes("echo") && t.successes % 3 == 0 && (t.value = k(t.value, 125), o.push("echo")), e.dayBuffs.loan && t.suppliedDay === e.day && t.slot === 1 && t.hits <= 3 && (t.value = Math.min(S, t.value + Math.floor((t.value - a) * 10 / 100)), o.push("loan")), t.cracked && s === "great" && e.traits.includes("crackedEdge") && o.push("crackedEdge"));
	}
	return t.peak = Math.max(t.peak, t.value), !n && t.status === "active" && (t.charge = Math.min(6, t.charge + 1)), {
		result: s,
		before: a,
		after: t.value,
		level: t.level,
		triggers: o
	};
}
function ue(e, t, n, r) {
	let i = e.eventId, a = 0;
	if (t === "accept") {
		let t = L(e, n);
		switch (a = t.cost === 0 ? 0 : -t.cost, e.coins -= t.cost, i) {
			case "donation": {
				let t = e.blades.find((e) => e.id === n);
				t.status = "donated", t.finalizedDay = e.day, e.pending.supplyPct = 120;
				break;
			}
			case "loan":
				e.pending.loan = !0;
				break;
			case "salvage": {
				let t = e.blades.find((e) => e.id === n);
				t.status = "bartered", t.finalizedDay = e.day, e.reserveId = null, e.coins += 160, a += 160;
				break;
			}
			case "credit":
				e.crackGuard = !0;
				break;
			case "shelter": e.pending.shelter = !0;
		}
	}
	let o = {
		day: e.day,
		id: i,
		choice: t,
		pieceId: n ?? null,
		coins: a
	};
	e.eventHistory.push(R(o)), e.eventStatus = t === "accept" ? "accepted" : "declined", r.push({
		type: "EventChoice",
		record: o
	});
}
function W(t, i) {
	if (t.rulesVersion !== "forge-v4") return z(t, "wrong_rules");
	let a = r(i);
	if (!a) return z(t, "invalid_command");
	let o = JSON.parse(a);
	if (!e(o) || !V(o, [
		"runId",
		"expectedRevision",
		"action"
	])) return z(t, "invalid_command");
	if (o.runId !== t.runId) return z(t, "wrong_run");
	if (o.expectedRevision !== t.revision) return z(t, "stale_revision");
	let s = se(o.action);
	if (!s) return z(t, "invalid_command");
	let c = s.type === "continue" ? "opening" : s.type === "chooseModification" ? "chapter" : s.type === "advance" ? "summary" : "workshop";
	if (t.phase !== c) return z(t, "wrong_phase");
	if (t.journal.length >= 2048 || t.journal.length >= 1900 && ([
		"strike",
		"setRecipe",
		"buy",
		"claimGift",
		"upgrade",
		"repair"
	].includes(s.type) || s.type === "reserve" && t.reserveId !== s.pieceId || s.type === "chooseEvent" && s.choice === "accept")) return z(t, "record_limit");
	let l = R(t), u = [], d = "pieceId" in s ? l.blades.find((e) => e.id === s.pieceId) : void 0;
	if ("pieceId" in s && s.type !== "chooseEvent" && (!d || d.status !== "active")) return z(t, "piece_unavailable");
	if ("pieceId" in s && s.type !== "chooseEvent" && s.type !== "reserve" && l.reserveId === s.pieceId) return z(t, "reserved_piece");
	switch (s.type) {
		case "continue":
			l.phase = "workshop", u.push({ type: "Opened" });
			break;
		case "setRecipe":
			if (!d) return z(t, "piece_unavailable");
			if (d.hits > 0) return z(t, "recipe_locked");
			if (!j(l).includes(s.recipe)) return z(t, "recipe_unavailable");
			if (d.recipe === s.recipe) return z(t, "unavailable");
			d.recipe = s.recipe, u.push({
				type: "Recipe",
				pieceId: d.id,
				recipe: d.recipe
			});
			break;
		case "strike": {
			if (!d) return z(t, "piece_unavailable");
			if (O(d)) return z(t, "at_cap");
			let e = d.charge === 6, n = [];
			if (e) {
				let e = d.bursts === 0 && l.modifications.includes("wideMouth"), t = l.traits.includes("ember"), r = 2 + Number(e) + Number(t);
				d.charge = 0, d.bursts++;
				for (let i = 0; i < r && !O(d); i++) {
					let r = le(l, d, !0);
					n.push({
						...r,
						triggers: [
							...r.triggers,
							...e ? ["wideMouth"] : [],
							...t ? ["ember"] : []
						]
					});
				}
			} else n.push(le(l, d, !1));
			u.push({
				type: "Strike",
				pieceId: d.id,
				burst: e,
				hits: n
			});
			break;
		}
		case "deliver": {
			if (!d) return z(t, "piece_unavailable");
			let e = N(l), n = !e.complete && P(l, d).qualifies;
			d.status = n ? "commissioned" : "sold", d.finalizedDay = l.day, d.commissionId = n ? A(l).id : null, l.coins += d.value, l.daySales += d.value, u.push({
				type: "Delivered",
				pieceId: d.id,
				amount: d.value,
				matched: n,
				commissionId: A(l).id
			});
			let r = N(l);
			!e.complete && r.complete && (u.push({
				type: "MainCompleted",
				commissionId: r.commissionId,
				routeId: r.routeId,
				pieceIds: r.pieceIds
			}), l.gift === "locked" && (l.gift = "available", u.push({ type: "GiftAvailable" })));
			break;
		}
		case "scrap":
			if (!d) return z(t, "piece_unavailable");
			d.status = "recycled", d.finalizedDay = l.day, l.coins += D(d), l.dayRecovered += D(d), u.push({
				type: "Disposed",
				pieceId: d.id,
				disposition: d.status,
				amount: D(d)
			});
			break;
		case "reserve":
			if (!d) return z(t, "piece_unavailable");
			{
				let e = l.reserveId;
				l.reserveId = e === d.id ? null : d.id, u.push({
					type: "Reserved",
					pieceId: d.id,
					previousId: e
				});
			}
			break;
		case "claimGift": {
			if (l.gift !== "available") return z(t, "unavailable");
			let e = ["steady", "ember"].filter((e) => !l.traits.includes(e));
			if (e.length) {
				if (s.traitId === null || !e.some((e) => e === s.traitId)) return z(t, "unavailable");
				let n = ce(l, s.traitId, s.replaceId);
				if (n) return z(t, n);
			} else {
				if (s.traitId !== null || s.replaceId !== void 0) return z(t, "unavailable");
				l.coins += 40;
			}
			l.gift = "claimed", u.push({
				type: "Trait",
				traitId: s.traitId
			});
			break;
		}
		case "buy":
			if (!I(l)) return z(t, "no_shop");
			if (!l.shop.includes(s.traitId) || l.sold.includes(s.traitId)) return z(t, "sold_out");
			{
				let e = ce(l, s.traitId, s.replaceId);
				if (e) return z(t, e);
			}
			if (!d) return z(t, "piece_unavailable");
			d.status = "traded", d.finalizedDay = l.day, l.sold.push(s.traitId), u.push({
				type: "Disposed",
				pieceId: d.id,
				disposition: d.status,
				amount: 0
			}, {
				type: "Trait",
				traitId: s.traitId
			});
			break;
		case "upgrade":
		case "repair": {
			let e = F(l);
			if (!I(l) || !e) return z(t, "no_shop");
			if (s.type === "upgrade" ? l.upgraded : l.repaired || l.seals === 3) return z(t, "unavailable");
			let n = s.type === "upgrade" ? e.upgrade : e.repair;
			if (l.coins < n) return z(t, "insufficient_coins");
			l.coins -= n, s.type === "upgrade" ? (l.upgradeCount++, l.upgraded = !0, u.push({ type: "Upgraded" })) : (l.seals++, l.repaired = !0, u.push({ type: "Repaired" }));
			break;
		}
		case "chooseEvent":
			if (l.eventStatus !== "available" || l.eventId === null) return z(t, "unavailable");
			if (s.choice === "decline" && s.pieceId !== void 0) return z(t, "invalid_command");
			if (s.choice === "accept") {
				let e = L(l, s.pieceId);
				if (e.error) return z(t, e.error);
			}
			ue(l, s.choice, s.pieceId, u);
			break;
		case "settle": {
			l.eventStatus === "available" && ue(l, "decline", void 0, u);
			let e = re(l), t = {
				day: l.day,
				commissionId: A(l).id,
				met: e.complete,
				routeId: e.routeId,
				pieceIds: e.pieceIds,
				sales: l.daySales,
				recovered: l.dayRecovered + e.recovered,
				recoveredIds: e.remaining.map((e) => e.id),
				reserveId: l.reserveId,
				sealsBefore: l.seals,
				sealsAfter: e.sealsAfter,
				protected: e.protected,
				modification: null
			};
			for (let e of l.blades) t.recoveredIds.includes(e.id) && (e.status = "recycled", e.finalizedDay = l.day);
			l.coins += e.recovered, l.dayRecovered += e.recovered, l.seals = e.sealsAfter, e.protected && (l.pardonUsed = !0), l.history.push(t), l.phase = l.seals === 0 ? "defeat" : l.day === 12 ? l.history.filter((e) => e.met).length >= 10 && [
				4,
				8,
				12
			].every((e) => l.history.some((t) => t.day === e && t.met)) ? "victory" : "return" : l.day === 4 || l.day === 8 ? "chapter" : "summary", l.phase === "chapter" && (l.chapterChoices = l.day === 4 ? ["windbox", "warmRack"] : p.filter((e) => !l.modifications.includes(e))), u.push({
				type: "Settled",
				record: t
			});
			break;
		}
		case "chooseModification":
			if (!l.chapterChoices.includes(s.modification) || l.modifications.includes(s.modification)) return z(t, "unavailable");
			l.modifications.push(s.modification), l.history.at(-1).modification = s.modification, l.chapterChoices = [], l.phase = "summary", u.push({
				type: "Modification",
				modification: s.modification
			});
			break;
		case "advance": {
			let e = l.blades.find((e) => e.id === l.reserveId);
			e && l.modifications.includes("warmRack") && (e.value = k(e.value, 115), e.peak = Math.max(e.peak, e.value)), l.day++, l.phase = "workshop", l.daySales = 0, l.dayRecovered = 0, l.dayBuffs = R(l.pending), l.pending = R(ie()), oe(l), u.push({ type: "Advanced" });
			break;
		}
	}
	return l.revision++, l.journal.push(s), n({
		ok: !0,
		state: l,
		events: u
	});
}
//#endregion
//#region src/core-v4/validate.ts
function G(t) {
	let n = r(t);
	if (!n) return {
		ok: !1,
		error: "invalid_state",
		detail: "Expected bounded plain JSON with safe integer fields."
	};
	let i = JSON.parse(n);
	if (!e(i) || i.rulesVersion !== "forge-v4") return {
		ok: !1,
		error: "invalid_rules_version",
		detail: "Expected forge-v4."
	};
	if (typeof i.runId != "string" || typeof i.seed != "string" || !Array.isArray(i.journal) || i.journal.length > 2048) return {
		ok: !1,
		error: "invalid_state",
		detail: "Missing identity or bounded Accepted journal."
	};
	let a = U({
		runId: i.runId,
		seed: i.seed,
		mode: i.mode,
		eligibility: i.initialEligibility
	});
	if (!a.ok) return {
		ok: !1,
		error: "invalid_state",
		detail: a.error
	};
	let o = a.state;
	for (let [e, t] of i.journal.entries()) {
		let n = W(o, {
			runId: o.runId,
			expectedRevision: o.revision,
			action: t
		});
		if (!n.ok) return {
			ok: !1,
			error: "invalid_journal",
			detail: `Command ${e}: ${n.error}`
		};
		o = n.state;
	}
	return r(o) === n ? {
		ok: !0,
		state: o
	} : {
		ok: !1,
		error: "invalid_state",
		detail: "Snapshot differs from full deterministic replay."
	};
}
//#endregion
//#region src/core-v4/view.ts
function de(e) {
	return [
		e.count > 1 ? `${e.count}柄各自合格` : "一柄",
		...e.recipe ? [h[e.recipe].name] : [],
		...e.crack ? [e.crack === "intact" ? "无裂纹" : "带裂纹"] : [],
		...e.age ? [e.age === "old" ? "昨日留剑" : "本日新剑"] : [],
		...e.maxHits === void 0 ? [] : [`普通锤≤${e.maxHits}`],
		...e.minLevel === void 0 ? [] : [`等级≥${e.minLevel}`],
		...e.minBursts === void 0 ? [] : [`连锻≥${e.minBursts}次`],
		`身价≥${e.value}`
	].join(" · ");
}
function K(e) {
	let t = e.history.filter((e) => [
		4,
		8,
		12
	].includes(e.day) && e.sealsAfter > 0).map((e) => E(e.day)), r = ["light"];
	t.includes(1) && r.push("guard"), t.includes(2) && r.push("heavy");
	let i = e.history.filter((e) => e.met).map((t) => ({
		commissionId: t.commissionId,
		day: t.day,
		routeId: t.routeId,
		blades: t.pieceIds.map((t) => e.blades.find((e) => e.id === t)),
		runId: e.runId
	})), a = f.filter((e) => i.some((t) => t.blades.some((t) => t.recipe === e && t.level >= 9))), o = [...new Set(e.journal.flatMap((e) => (e.type === "buy" || e.type === "claimGift") && e.traitId ? [e.traitId] : []))];
	return n({
		chapters: t,
		recipes: r,
		challenge: e.phase === "victory",
		mastery: a,
		traits: o,
		works: i
	});
}
function fe(e) {
	let t = A(e), r = N(e), i = e.phase === "workshop", a = e.journal.length < w, o = F(e), s = e.day < 12 ? {
		day: e.day + 1,
		commission: b[e.commissionOrder[e.day] - 1],
		normalBase: ee(e, e.day + 1, e.pending.supplyPct),
		merchant: v.some((t) => t.day === e.day + 1),
		reserve: e.reserveId ? e.blades.filter((t) => t.id === e.reserveId).map((t) => ({
			id: t.id,
			value: e.modifications.includes("warmRack") ? k(t.value, 115) : t.value,
			cracked: t.cracked,
			charge: t.charge
		}))[0] ?? null : null
	} : null, c = s ? {
		...s,
		inheritanceBonus: Math.min(s.normalBase * 4, e.inheritance),
		firstBase: s.normalBase + Math.min(s.normalBase * 4, e.inheritance)
	} : null, l = [
		4,
		8,
		12
	].filter((t) => !e.history.some((e) => e.day === t && e.met));
	return n({
		rulesVersion: e.rulesVersion,
		revision: e.revision,
		phase: e.phase,
		day: e.day,
		chapter: _[E(e.day) - 1],
		mode: e.mode,
		coins: e.coins,
		seals: e.seals,
		commission: {
			...t,
			progress: r,
			routes: t.routes.map((e) => ({
				...e,
				description: de(e)
			})),
			outcome: r.complete ? t.success : t.failure
		},
		recipes: j(e).map((e) => ({
			id: e,
			...h[e]
		})),
		recommendedRecipe: te(e),
		blades: e.blades.filter((e) => e.status === "active").map((t) => ({
			blade: t,
			reserved: t.id === e.reserveId,
			assessment: P(e, t),
			odds: ne(e, t),
			recovery: D(t),
			willCommission: !r.complete && P(e, t).qualifies,
			canStrike: i && a && t.id !== e.reserveId && !O(t),
			canChangeRecipe: i && a && t.id !== e.reserveId && t.hits === 0
		})),
		traits: e.traits.map((t) => ({
			id: t,
			...u[t],
			used: t === "pardon" && e.pardonUsed
		})),
		modifications: e.modifications.map((e) => ({
			id: e,
			...g[e]
		})),
		chapterChoices: e.chapterChoices.map((e) => ({
			id: e,
			...g[e]
		})),
		growth: {
			supplyBase: e.supplyBase,
			upgradeCount: e.upgradeCount,
			inheritance: e.inheritance,
			crackGuard: e.crackGuard,
			dayBuffs: e.dayBuffs,
			pending: e.pending
		},
		event: e.eventId ? {
			id: e.eventId,
			...y[e.eventId],
			status: e.eventStatus,
			quote: L(e),
			canDecline: i && e.eventStatus === "available"
		} : null,
		merchant: I(e) && o ? {
			...o,
			offers: e.shop.map((t) => ({
				id: t,
				...u[t],
				sold: e.sold.includes(t),
				owned: e.traits.includes(t)
			})),
			canUpgrade: a && !e.upgraded && e.coins >= o.upgrade,
			canRepair: a && !e.repaired && e.seals < 3 && e.coins >= o.repair
		} : null,
		gift: {
			status: e.gift,
			canClaim: i && a && e.gift === "available"
		},
		next: c,
		settlement: re(e),
		canContinue: e.phase === "opening",
		canSettle: i,
		canAdvance: e.phase === "summary",
		ending: e.phase === "victory" || e.phase === "return" || e.phase === "defeat" ? {
			...x[e.phase],
			missingCritical: l,
			completed: e.history.filter((e) => e.met).length,
			finalBladeMade: e.history.some((e) => e.day === 12 && e.met)
		} : null,
		history: e.history,
		eventHistory: e.eventHistory,
		collection: K(e)
	});
}
//#endregion
//#region src/application/v4-collection.ts
var q = "sword-led.collection.v1", J = "sword-led.collection.backup.v1", pe = (e, t) => Object.keys(e).sort().join(",") === [...t].sort().join(","), Y = (e, t, n) => Number.isSafeInteger(e) && Number(e) >= t && Number(e) <= n, me = (e, t) => r(e) === r(t), he = (e) => typeof e == "string" && /^[A-Za-z0-9_-]{1,80}$/.test(e), X = () => n({
	chapters: [],
	mastery: [],
	traits: [],
	challenge: !1,
	works: []
});
function ge(t, n) {
	return !e(t) || !pe(t, [
		"id",
		"slot",
		"suppliedDay",
		"recipe",
		"status",
		"base",
		"value",
		"peak",
		"level",
		"cracked",
		"hits",
		"charge",
		"successes",
		"normalGreats",
		"bursts",
		"finalizedDay",
		"commissionId"
	]) || !Y(t.slot, 1, 3) || !Y(t.suppliedDay, 1, n.day) || t.id !== `d${t.suppliedDay}-${t.slot}` || !f.some((e) => e === t.recipe) || t.status !== "commissioned" || t.finalizedDay !== n.day || t.commissionId !== n.commissionId || typeof t.cracked != "boolean" || !Y(t.base, 1, 1e9) || !Y(t.value, 1, 1e9) || !Y(t.peak, t.value, 1e9) || !Y(t.level, 0, 99) || !Y(t.hits, 0, 2048) || !Y(t.charge, 0, 6) || !Y(t.bursts, 0, 2048) || !Y(t.successes, 0, t.hits) || !Y(t.normalGreats, 0, t.successes) ? !1 : t.hits === t.bursts * 6 + t.charge;
}
function _e(t) {
	if (!e(t) || !pe(t, [
		"commissionId",
		"day",
		"routeId",
		"runId",
		"blades"
	]) || !Y(t.commissionId, 1, 12) || !Y(t.day, 1, 12) || !he(t.runId)) return !1;
	let n = b[t.commissionId - 1].routes.find((e) => e.id === t.routeId);
	if (!n || !Array.isArray(t.blades) || t.blades.length !== n.count || !(t.commissionId <= 4 || t.commissionId === 8 || t.commissionId === 12 ? [t.commissionId] : t.commissionId < 8 ? [
		5,
		6,
		7
	] : [
		9,
		10,
		11
	]).includes(t.day)) return !1;
	let r = {
		day: t.day,
		commissionId: t.commissionId
	};
	return t.blades.every((e) => ge(e, r) && M({ day: r.day }, e, n).matches) && new Set(t.blades.map((e) => e.id)).size === n.count;
}
var ve = (e) => e.blades.reduce((e, t) => e + t.value, 0);
function ye(e, t) {
	let n = ve(e) - ve(t);
	return n > 0 ? e : n < 0 ? t : r(e) <= r(t) ? e : t;
}
function Z(e, t) {
	let r = /* @__PURE__ */ new Map();
	for (let n of [...e.works, ...t.works]) r.set(n.commissionId, r.has(n.commissionId) ? ye(r.get(n.commissionId), n) : n);
	return n({
		chapters: [.../* @__PURE__ */ new Set([...e.chapters, ...t.chapters])].sort((e, t) => e - t),
		mastery: f.filter((n) => e.mastery.includes(n) || t.mastery.includes(n)),
		traits: d.filter((n) => e.traits.includes(n) || t.traits.includes(n)),
		challenge: e.challenge || t.challenge,
		works: [...r.values()].sort((e, t) => e.commissionId - t.commissionId)
	});
}
function be(t) {
	let n = () => ({
		ok: !1,
		error: "invalid_state",
		detail: "Expected bounded collection sets and valid commission receipts."
	}), i = r(t);
	if (!i) return n();
	let a = JSON.parse(i);
	if (!e(a) || !pe(a, [
		"chapters",
		"mastery",
		"traits",
		"challenge",
		"works"
	]) || typeof a.challenge != "boolean" || !Array.isArray(a.chapters) || a.chapters.length > 3 || !a.chapters.every((e) => Y(e, 1, 3)) || !Array.isArray(a.mastery) || a.mastery.length > 3 || !a.mastery.every((e) => f.some((t) => t === e)) || !Array.isArray(a.traits) || a.traits.length > 6 || !a.traits.every((e) => d.some((t) => t === e)) || !Array.isArray(a.works) || a.works.length > 12 || !a.works.every(_e)) return n();
	let o = a, s = Z(X(), o);
	return !me(s, o) || o.chapters.some((e) => e > 1 && !o.chapters.includes(e - 1)) || o.challenge && (!o.chapters.includes(3) || o.works.length < 10 || ![
		4,
		8,
		12
	].every((e) => o.works.some((t) => t.commissionId === e))) ? n() : {
		ok: !0,
		state: s
	};
}
function Q(e) {
	let t = K(e);
	return Z(X(), {
		chapters: t.chapters,
		mastery: t.mastery,
		traits: t.traits,
		challenge: t.challenge,
		works: t.works
	});
}
function xe(e) {
	let t = G(e);
	return t.ok ? {
		ok: !0,
		state: Q(t.state)
	} : t;
}
function Se(e) {
	return n({
		recipes: f.filter((t) => t === "light" || t === "guard" && e.chapters.includes(1) || t === "heavy" && e.chapters.includes(2)),
		challenge: e.challenge
	});
}
var Ce = Object.freeze({
	key: q,
	backupKey: J,
	schemaVersion: 1,
	rulesVersion: "forge-v4-collection-v1",
	validate: be
}), we = (e) => l(e, Ce);
function Te(e, t) {
	let n = s(e, Ce, t), r = (t) => {
		try {
			return {
				ok: !0,
				raw: e().getItem(t)
			};
		} catch {
			return { ok: !1 };
		}
	};
	return {
		...n,
		readRaw: () => ({
			main: r(q),
			backup: r(J)
		})
	};
}
//#endregion
//#region src/application/v4-persistence.ts
var Ee = "sword-led.save.v4", De = "sword-led.save.backup.v4", $ = Object.freeze({
	key: Ee,
	backupKey: De,
	schemaVersion: 4,
	rulesVersion: "forge-v4",
	validate: G
}), Oe = (e) => l(e, $), ke = (e, t) => s(e, $, t);
function Ae(t, i, o) {
	let s = X(), c = null, l = null, u = !1, d = null, f = !1, p = !1, m = !1, h = !1, g = null, _ = /* @__PURE__ */ new Set(), v = /* @__PURE__ */ new Set(), y = a(t, i, {
		createRun: (t) => {
			let n = r(t);
			if (!n) return {
				ok: !1,
				error: "invalid_command"
			};
			let i = JSON.parse(n);
			if (!e(i) || Object.keys(i).some((e) => ![
				"runId",
				"seed",
				"mode"
			].includes(e))) return {
				ok: !1,
				error: "invalid_command"
			};
			let a = Se(c?.main.status === "valid" ? c.main.state : X());
			return U({
				...t,
				eligibility: a
			});
		},
		applyCommand: W,
		isTerminal: (e) => [
			"victory",
			"return",
			"defeat"
		].includes(e.phase)
	}), b = (e = y.getSnapshot()) => !f && e.mode === "writer" && e.active && !e.dirty && !e.conflict && i.owns() && t.isCurrent(), x = () => n({
		data: s,
		load: c,
		pending: u,
		lastSave: l,
		problem: d,
		writable: b()
	}), S = (e) => ({
		ok: !1,
		error: e,
		snapshot: y.getSnapshot()
	}), C = (e) => {
		let t = y.getSnapshot();
		return f ? "disposed" : e === t.generation ? t.active ? t.mode !== "writer" || !i.owns() ? "readonly" : null : "not_active" : "stale_session";
	};
	function w(e = !0) {
		if (f) return;
		let n = y.getSnapshot();
		c = o.load();
		let i = c.main, a = i.status === "valid" ? i.state : X();
		s = Z(s, a), b(n) && n.state && (s = Z(s, Q(n.state)));
		let p = r(s) !== r(a), m = n.dirty && n.mode !== "memory" && n.state !== null && r(Z(s, Q(n.state))) !== r(s);
		u = p || m;
		let h = c.backup;
		d = i.status === "invalid" || i.status === "unavailable" ? i.error : i.status === "empty" && h.status !== "empty" ? h.status === "valid" ? "recovery_required" : h.error : null, m && d === null && (d = "run_unsaved"), p && d === null && e && (n.dirty ? d = "run_unsaved" : b(n) ? (l = o.write(s, { raw: o.token() }), u = !l.ok, l.ok ? c = {
			main: {
				status: "valid",
				state: s,
				savedAt: l.savedAt
			},
			backup: o.inspect().backup
		} : d = l.error) : n.active && n.mode === "writer" && !t.isCurrent() && (d = "run_changed"));
	}
	function T() {
		if (f && y.getSnapshot().mode !== "disposed") return;
		if (m) {
			h = !0;
			return;
		}
		m = !0;
		let e = y.getSnapshot(), t = x();
		try {
			for (let t of _) {
				if (y.getSnapshot().generation !== e.generation) break;
				try {
					t(e);
				} catch {}
			}
			for (let n of v) {
				if (y.getSnapshot().generation !== e.generation) break;
				try {
					n(t);
				} catch {}
			}
		} finally {
			m = !1, h && (h = !1, T());
		}
	}
	function E(e) {
		if (p || m) return S("session_busy");
		p = !0;
		try {
			return e();
		} finally {
			p = !1;
		}
	}
	let D = y.subscribe(() => {
		w(), T();
	});
	return {
		getSnapshot: y.getSnapshot,
		getCollectionSnapshot: x,
		subscribe: (e) => {
			_.add(e);
			try {
				e(y.getSnapshot());
			} catch {}
			return () => {
				_.delete(e);
			};
		},
		subscribeCollection: (e) => {
			v.add(e);
			try {
				e(x());
			} catch {}
			return () => {
				v.delete(e);
			};
		},
		activate: async () => p || m ? y.getSnapshot() : y.activate(),
		startNewGame: (e, t) => E(() => {
			let n = C(t.generation);
			return n && y.getSnapshot().mode !== "memory" ? S(n) : t.generation === y.getSnapshot().generation ? (w(), y.getSnapshot().mode !== "memory" && u ? S("collection_pending") : y.startNewGame(e, t)) : S("stale_session");
		}),
		resume: (e) => E(() => y.resume(e)),
		recoverBackup: (e) => E(() => y.recoverBackup(e)),
		useMemory: (e, t) => E(() => (w(!1), y.useMemory(e, t))),
		dispatch: (e, t) => {
			if (p || m) return {
				ok: !1,
				error: "session_busy",
				state: y.getSnapshot().state,
				events: [],
				snapshot: y.getSnapshot()
			};
			p = !0;
			try {
				return y.dispatch(e, t);
			} finally {
				p = !1;
			}
		},
		retrySave: (e) => E(() => y.retrySave(e)),
		retryCollection: (e) => E(() => {
			let t = C(e);
			return t ? S(t) : (w(), T(), u || d ? S("collection_unavailable") : {
				ok: !0,
				snapshot: y.getSnapshot()
			});
		}),
		recoverCollectionBackup: (e) => E(() => {
			let t = C(e.generation);
			if (t) return S(t);
			if (!e.confirmed) return S("confirmation_required");
			if (c = o.load(), c.main.status === "valid") return S("main_available");
			if (c.main.status === "unavailable" || c.backup.status !== "valid") return S("backup_unavailable");
			if (!b()) return S("collection_unavailable");
			s = Z(s, c.backup.state);
			let n = y.getSnapshot();
			return n.state && (s = Z(s, Q(n.state))), l = o.write(s, { raw: o.token() }), u = !l.ok, d = l.ok ? null : l.error, l.ok && (c = {
				main: {
					status: "valid",
					state: s,
					savedAt: l.savedAt
				},
				backup: o.inspect().backup
			}), T(), l.ok ? {
				ok: !0,
				snapshot: y.getSnapshot()
			} : S("collection_unavailable");
		}),
		notifyExternalChange: () => {
			f || y.notifyExternalChange();
		},
		notifyCollectionChange: () => {
			f || p || m || (w(), T());
		},
		exportRun: () => {
			let e = y.getSnapshot().state;
			return e ? JSON.stringify(e, null, 2) : null;
		},
		exportCollection: () => JSON.stringify({
			format: "sword-led.collection-export.v1",
			collection: s,
			stored: o.readRaw()
		}, null, 2),
		suspend: () => m && !y.getSnapshot().active ? Promise.resolve() : y.suspend(),
		dispose: () => {
			if (f) return g ?? Promise.resolve();
			f = !0, g = y.dispose(), D();
			let e = () => {
				_.clear(), v.clear();
			};
			return m ? g.then(e, e) : e(), g;
		}
	};
}
function je(e = window) {
	let t = c(e, Ee, (t) => Ae(ke(() => e.localStorage), o(t), Te(() => e.localStorage))), n = (e) => {
		(e.key === "sword-led.collection.v1" || e.key === "sword-led.collection.backup.v1" || e.key === null) && t.notifyCollectionChange();
	};
	return e.addEventListener("storage", n), {
		...t,
		dispose: () => (e.removeEventListener("storage", n), t.dispose())
	};
}
//#endregion
export { _ as CHAPTERS, J as COLLECTION_BACKUP_KEY, Ce as COLLECTION_CODEC, q as COLLECTION_KEY, b as COMMISSIONS, x as ENDINGS, y as EVENTS, m as EVENT_IDS, T as JOURNAL_LIMIT, w as JOURNAL_SOFT_LIMIT, C as LEVEL_CAP, v as MERCHANTS, g as MODIFICATIONS, p as MODIFICATION_IDS, h as RECIPES, f as RECIPE_IDS, u as TRAITS, d as TRAIT_IDS, De as V4_BACKUP_KEY, $ as V4_CODEC, Ee as V4_SAVE_KEY, S as VALUE_CAP, W as applyCommand, P as assessBlade, O as atCap, E as chapterFor, Se as collectionEligibility, xe as collectionFromRun, A as commissionFor, N as commissionProgress, Te as createCollectionRepository, U as createRun, je as createV4BrowserSession, ke as createV4SaveRepository, Ae as createV4Session, we as decodeCollection, Oe as decodeV4Save, de as describeRoute, X as emptyCollection, L as eventQuote, K as getCollectionAwards, fe as getRunView, F as merchantFor, I as merchantPresent, Z as mergeCollections, se as parseAction, k as percent, te as recommendedRecipe, D as recovery, M as routeAssessment, re as settlementPreview, ne as strikeOdds, ee as supplyBaseFor, j as unlockedRecipes, be as validateCollection, G as validateRun };
