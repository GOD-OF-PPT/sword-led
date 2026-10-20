import { D as e, f as t, l as n, r, u as i } from "./validate-ZT3_gYFg.js";
import { n as a, r as o } from "./rules-CAo3EZyg.js";
//#region src/core-v4/content.ts
var s = Object.freeze([
	"light",
	"guard",
	"heavy"
]), c = Object.freeze([
	"windbox",
	"warmRack",
	"wideMouth"
]), l = Object.freeze([
	"donation",
	"loan",
	"salvage",
	"credit",
	"shelter",
	"rest"
]), u = e({
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
}), d = e({
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
}), f = e([
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
]), p = e([
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
]), m = e({
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
}), h = e([
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
]), g = e({
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
}), _ = 1e9, v = 99, y = 1900, b = 2048, x = (e) => e <= 4 ? 1 : e <= 8 ? 2 : 3, S = (e) => Math.floor(e.base / 4), C = (e) => e.value >= 1e9 || e.level >= 99, w = (e, t) => Math.min(_, Math.floor(e * t / 100));
function T(e, t, n) {
	return Math.floor(f[x(t) - 1].base * 3 ** e.upgradeCount / 2 ** e.upgradeCount * n / 100);
}
function E(e) {
	return h[e.commissionOrder[e.day - 1] - 1];
}
function D(e) {
	let t = new Set(e.initialEligibility.recipes);
	e.history.some((e) => e.day === 4 && e.sealsAfter > 0) && t.add("guard"), e.history.some((e) => e.day === 8 && e.sealsAfter > 0) && t.add("heavy");
	for (let n of E(e).routes) n.recipe && t.add(n.recipe);
	return [
		"light",
		"guard",
		"heavy"
	].filter((e) => t.has(e));
}
function O(e) {
	return E(e).routes.find((e) => e.recipe)?.recipe || (D(e).includes("guard") ? "guard" : "light");
}
function k(e, t) {
	let n = u[t.recipe], r = e.dayBuffs.shelter && t.suppliedDay === e.day && t.slot === 1, i = Math.max(0, (t.hits < 3 ? 0 : n.cracks[Math.min(t.hits - 3, 8)]) - (r ? 30 : 0)), a = t.charge === 6, o = a ? 350 : n.greatOdds + (t.cracked && e.traits.includes("crackedEdge") ? 100 : 0);
	return {
		burst: a,
		crack: a ? 0 : i,
		great: o,
		success: 1e3 - o - (a ? 0 : i),
		afterBurstCrack: i
	};
}
function A(e, t, n) {
	let r = [];
	return n.recipe && t.recipe !== n.recipe && r.push(`需要${u[n.recipe].name}`), n.crack === "intact" && t.cracked && r.push("需要无裂纹"), n.crack === "cracked" && !t.cracked && r.push("需要带裂纹"), n.age === "old" && t.suppliedDay >= e.day && r.push("需要昨日留下的旧剑"), n.age === "new" && t.suppliedDay !== e.day && r.push("需要本日新剑"), n.maxHits !== void 0 && t.hits > n.maxHits && r.push(`普通锤不得超过${n.maxHits}次`), n.minLevel !== void 0 && t.level < n.minLevel && r.push(`需要等级${n.minLevel}`), n.minBursts !== void 0 && t.bursts < n.minBursts && r.push(`需要${n.minBursts}次连锻`), t.value < n.value && r.push(`还差${n.value - t.value}身价`), {
		matches: r.length === 0,
		missing: r
	};
}
function j(e) {
	let t = E(e), n = e.blades.filter((n) => n.status === "commissioned" && n.commissionId === t.id && n.finalizedDay === e.day), r = new Map(e.journal.flatMap((e, t) => e.type === "deliver" ? [[e.pieceId, t]] : []));
	n.sort((e, t) => (r.get(e.id) ?? 2 ** 53 - 1) - (r.get(t.id) ?? 2 ** 53 - 1));
	let i = t.routes.map((t) => {
		let r = n.filter((n) => A(e, n, t).matches).map((e) => e.id);
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
function M(e, t) {
	let n = E(e).routes.map((n) => ({
		id: n.id,
		...A(e, t, n)
	}));
	return {
		canDeliver: e.phase === "workshop" && t.status === "active" && t.id !== e.reserveId,
		qualifies: n.some((e) => e.matches),
		routes: n
	};
}
function N(e) {
	let t = e.blades.filter((t) => t.status === "active" && t.id !== e.reserveId), n = j(e), r = !n.complete && e.traits.includes("pardon") && !e.pardonUsed;
	return {
		...n,
		remaining: t,
		recovered: t.reduce((e, t) => e + S(t), 0),
		protected: r,
		sealsAfter: e.seals - (n.complete || r ? 0 : 1)
	};
}
var P = (e) => p.find((t) => t.day === e.day) ?? null, F = (e) => e.phase === "workshop" && P(e) !== null;
function I(e, t) {
	let n = e.eventId ? m[e.eventId] : null, r = n?.cost[x(e.day) - 1] ?? 0, i = null;
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
var L = (e) => structuredClone(e), R = (e, t) => ({
	ok: !1,
	state: e,
	error: t,
	events: []
}), z = () => ({
	supplyPct: 100,
	loan: !1,
	shelter: !1
}), B = (e, t) => typeof e == "string" && t.some((t) => t === e), V = (e, t) => Object.keys(e).sort().join(",") === [...t].sort().join(",");
function H(e, t, n) {
	let r = i(e.rng[t]);
	return e.rng[t] = r.stream, Math.floor(r.value * n);
}
function U(e, t, n) {
	let r = [...n];
	for (let n = r.length - 1; n > 0; n--) {
		let i = H(e, t, n + 1);
		[r[n], r[i]] = [r[i], r[n]];
	}
	return r;
}
function W(e) {
	e.supplyBase = T(e, e.day, e.dayBuffs.supplyPct);
	let t = Math.min(e.supplyBase * 4, e.inheritance), n = O(e);
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
	let r = p.find((t) => t.day === e.day);
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
function G(i) {
	let a = r(i);
	if (!a) return {
		ok: !1,
		error: "invalid_command"
	};
	let o = JSON.parse(a);
	if (!t(o)) return {
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
	let c = o.seed.normalize("NFC").trim();
	if (!c || Array.from(c).length > 64) return {
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
	let u = {
		recipes: ["light"],
		challenge: !1
	};
	if (o.eligibility !== void 0) {
		let e = o.eligibility;
		if (!t(e) || !V(e, ["recipes", "challenge"]) || !Array.isArray(e.recipes) || e.recipes.length > 3 || !e.recipes.every((e) => B(e, s)) || typeof e.challenge != "boolean") return {
			ok: !1,
			error: "invalid_command"
		};
		let n = e.recipes;
		u = {
			recipes: s.filter((t) => t === "light" || e.challenge || n.includes(t)),
			challenge: e.challenge
		};
	}
	if (o.mode === "challenge" && !u.challenge) return {
		ok: !1,
		error: "challenge_locked"
	};
	let d = (e) => ({
		state: n(`${c}|v4|${e}`),
		draws: 0
	}), f = {
		rulesVersion: "forge-v4",
		runId: o.runId,
		seed: c,
		mode: o.mode ?? "story",
		initialEligibility: L(u),
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
		dayBuffs: L(z()),
		pending: L(z()),
		eventDeck: [],
		eventId: null,
		eventStatus: "none",
		eventHistory: [],
		history: [],
		rng: {
			forge: d("forge"),
			shop: d("shop"),
			events: d("events"),
			content: d("content")
		},
		journal: []
	};
	if (f.eventDeck = U(f, "events", l), f.mode === "challenge") for (let e of [[
		5,
		6,
		7
	], [
		9,
		10,
		11
	]]) {
		let t = U(f, "content", e);
		for (let n = 0; n < e.length; n++) f.commissionOrder[e[n] - 1] = t[n];
	}
	return W(f), e({
		ok: !0,
		state: f
	});
}
function K(e) {
	if (!t(e)) return null;
	let n = typeof e.pieceId == "string" && e.pieceId.length <= 32;
	switch (e.type) {
		case "continue":
		case "upgrade":
		case "repair":
		case "settle":
		case "advance": return V(e, ["type"]) ? { type: e.type } : null;
		case "strike":
		case "deliver":
		case "scrap":
		case "reserve": return n && V(e, ["type", "pieceId"]) ? {
			type: e.type,
			pieceId: e.pieceId
		} : null;
		case "setRecipe": return n && B(e.recipe, s) && V(e, [
			"type",
			"pieceId",
			"recipe"
		]) ? {
			type: e.type,
			pieceId: e.pieceId,
			recipe: e.recipe
		} : null;
		case "chooseModification": return B(e.modification, c) && V(e, ["type", "modification"]) ? {
			type: e.type,
			modification: e.modification
		} : null;
		case "chooseEvent": return (e.choice === "accept" || e.choice === "decline") && (e.pieceId === void 0 || n) && V(e, [
			"type",
			"choice",
			...e.pieceId === void 0 ? [] : ["pieceId"]
		]) ? {
			type: e.type,
			choice: e.choice,
			...e.pieceId === void 0 ? {} : { pieceId: e.pieceId }
		} : null;
		case "buy":
		case "claimGift": return e.type === "buy" && !n || !B(e.traitId, o) && (e.type !== "claimGift" || e.traitId !== null) || e.replaceId !== void 0 && !B(e.replaceId, o) || !V(e, [
			"type",
			"traitId",
			...e.type === "buy" ? ["pieceId"] : [],
			...e.replaceId === void 0 ? [] : ["replaceId"]
		]) ? null : e;
		default: return null;
	}
}
function q(e, t, n) {
	if (e.traits.includes(t)) return "already_owned";
	if (e.traits.length === 3) {
		if (!n || !e.traits.includes(n)) return "invalid_replacement";
		e.traits.splice(e.traits.indexOf(n), 1);
	} else if (n !== void 0) return "invalid_replacement";
	return e.traits.push(t), null;
}
function J(e, t, n) {
	let r = k(e, t), i = H(e, "forge", 1e3), a = t.value, o = [], s = i < (n ? 350 : r.great) ? "great" : !n && i < r.great + r.crack ? "crack" : "success";
	if (n || t.hits++, !n && e.dayBuffs.shelter && t.slot === 1 && t.suppliedDay === e.day && o.push("shelter"), s === "crack") {
		if (t.cracked) {
			s = "broken", t.value = 0, t.status = "broken", t.finalizedDay = e.day;
			let n = S(t);
			e.coins += n, e.dayRecovered += n, e.traits.includes("inherit") && (e.inheritance += Math.floor(t.peak / 5), o.push("inherit"));
		} else {
			t.cracked = !0;
			let n = e.traits.includes("steady"), r = e.crackGuard;
			n && o.push("steady"), r && (o.push("credit"), e.crackGuard = !1), !n && !r && (t.value = w(t.value, 80));
		}
	} else {
		let r = u[t.recipe];
		t.value = w(t.value, s === "great" ? r.great : r.success), t.level = Math.min(99, t.level + (s === "great" ? 2 : 1)), n || (s === "great" && (t.normalGreats === 0 && e.modifications.includes("windbox") && (t.value = w(t.value, 110), o.push("windbox")), t.normalGreats++), t.successes++, e.traits.includes("echo") && t.successes % 3 == 0 && (t.value = w(t.value, 125), o.push("echo")), e.dayBuffs.loan && t.suppliedDay === e.day && t.slot === 1 && t.hits <= 3 && (t.value = Math.min(_, t.value + Math.floor((t.value - a) * 10 / 100)), o.push("loan")), t.cracked && s === "great" && e.traits.includes("crackedEdge") && o.push("crackedEdge"));
	}
	return t.peak = Math.max(t.peak, t.value), !n && t.status === "active" && (t.charge = Math.min(6, t.charge + 1)), {
		result: s,
		before: a,
		after: t.value,
		level: t.level,
		triggers: o
	};
}
function Y(e, t, n, r) {
	let i = e.eventId, a = 0;
	if (t === "accept") {
		let t = I(e, n);
		switch (a = -t.cost, e.coins -= t.cost, i) {
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
	e.eventHistory.push(L(o)), e.eventStatus = t === "accept" ? "accepted" : "declined", r.push({
		type: "EventChoice",
		record: o
	});
}
function X(n, i) {
	if (n.rulesVersion !== "forge-v4") return R(n, "wrong_rules");
	let a = r(i);
	if (!a) return R(n, "invalid_command");
	let o = JSON.parse(a);
	if (!t(o) || !V(o, [
		"runId",
		"expectedRevision",
		"action"
	])) return R(n, "invalid_command");
	if (o.runId !== n.runId) return R(n, "wrong_run");
	if (o.expectedRevision !== n.revision) return R(n, "stale_revision");
	let s = K(o.action);
	if (!s) return R(n, "invalid_command");
	let l = s.type === "continue" ? "opening" : s.type === "chooseModification" ? "chapter" : s.type === "advance" ? "summary" : "workshop";
	if (n.phase !== l) return R(n, "wrong_phase");
	if (n.journal.length >= 2048 || n.journal.length >= 1900 && ([
		"strike",
		"setRecipe",
		"buy",
		"claimGift",
		"upgrade",
		"repair"
	].includes(s.type) || s.type === "reserve" && n.reserveId !== s.pieceId || s.type === "chooseEvent" && s.choice === "accept")) return R(n, "record_limit");
	let u = L(n), d = [], f = "pieceId" in s ? u.blades.find((e) => e.id === s.pieceId) : void 0;
	if ("pieceId" in s && s.type !== "chooseEvent" && (!f || f.status !== "active")) return R(n, "piece_unavailable");
	if ("pieceId" in s && s.type !== "chooseEvent" && s.type !== "reserve" && u.reserveId === s.pieceId) return R(n, "reserved_piece");
	switch (s.type) {
		case "continue":
			u.phase = "workshop", d.push({ type: "Opened" });
			break;
		case "setRecipe":
			if (!f) return R(n, "piece_unavailable");
			if (f.hits > 0) return R(n, "recipe_locked");
			if (!D(u).includes(s.recipe)) return R(n, "recipe_unavailable");
			if (f.recipe === s.recipe) return R(n, "unavailable");
			f.recipe = s.recipe, d.push({
				type: "Recipe",
				pieceId: f.id,
				recipe: f.recipe
			});
			break;
		case "strike": {
			if (!f) return R(n, "piece_unavailable");
			if (C(f)) return R(n, "at_cap");
			let e = f.charge === 6, t = [];
			if (e) {
				let e = f.bursts === 0 && u.modifications.includes("wideMouth"), n = u.traits.includes("ember"), r = 2 + Number(e) + Number(n);
				f.charge = 0, f.bursts++;
				for (let i = 0; i < r && !C(f); i++) {
					let r = J(u, f, !0);
					t.push({
						...r,
						triggers: [
							...r.triggers,
							...e ? ["wideMouth"] : [],
							...n ? ["ember"] : []
						]
					});
				}
			} else t.push(J(u, f, !1));
			d.push({
				type: "Strike",
				pieceId: f.id,
				burst: e,
				hits: t
			});
			break;
		}
		case "deliver": {
			if (!f) return R(n, "piece_unavailable");
			let e = j(u), t = !e.complete && M(u, f).qualifies;
			f.status = t ? "commissioned" : "sold", f.finalizedDay = u.day, f.commissionId = t ? E(u).id : null, u.coins += f.value, u.daySales += f.value, d.push({
				type: "Delivered",
				pieceId: f.id,
				amount: f.value,
				matched: t,
				commissionId: E(u).id
			});
			let r = j(u);
			!e.complete && r.complete && (d.push({
				type: "MainCompleted",
				commissionId: r.commissionId,
				routeId: r.routeId,
				pieceIds: r.pieceIds
			}), u.gift === "locked" && (u.gift = "available", d.push({ type: "GiftAvailable" })));
			break;
		}
		case "scrap":
			if (!f) return R(n, "piece_unavailable");
			f.status = "recycled", f.finalizedDay = u.day, u.coins += S(f), u.dayRecovered += S(f), d.push({
				type: "Disposed",
				pieceId: f.id,
				disposition: f.status,
				amount: S(f)
			});
			break;
		case "reserve":
			if (!f) return R(n, "piece_unavailable");
			{
				let e = u.reserveId;
				u.reserveId = e === f.id ? null : f.id, d.push({
					type: "Reserved",
					pieceId: f.id,
					previousId: e
				});
			}
			break;
		case "claimGift": {
			if (u.gift !== "available") return R(n, "unavailable");
			let e = ["steady", "ember"].filter((e) => !u.traits.includes(e));
			if (e.length) {
				if (s.traitId === null || !e.some((e) => e === s.traitId)) return R(n, "unavailable");
				let t = q(u, s.traitId, s.replaceId);
				if (t) return R(n, t);
			} else {
				if (s.traitId !== null || s.replaceId !== void 0) return R(n, "unavailable");
				u.coins += 40;
			}
			u.gift = "claimed", d.push({
				type: "Trait",
				traitId: s.traitId
			});
			break;
		}
		case "buy":
			if (!F(u)) return R(n, "no_shop");
			if (!u.shop.includes(s.traitId) || u.sold.includes(s.traitId)) return R(n, "sold_out");
			{
				let e = q(u, s.traitId, s.replaceId);
				if (e) return R(n, e);
			}
			if (!f) return R(n, "piece_unavailable");
			f.status = "traded", f.finalizedDay = u.day, u.sold.push(s.traitId), d.push({
				type: "Disposed",
				pieceId: f.id,
				disposition: f.status,
				amount: 0
			}, {
				type: "Trait",
				traitId: s.traitId
			});
			break;
		case "upgrade":
		case "repair": {
			let e = P(u);
			if (!F(u) || !e) return R(n, "no_shop");
			if (s.type === "upgrade" ? u.upgraded : u.repaired || u.seals === 3) return R(n, "unavailable");
			let t = s.type === "upgrade" ? e.upgrade : e.repair;
			if (u.coins < t) return R(n, "insufficient_coins");
			u.coins -= t, s.type === "upgrade" ? (u.upgradeCount++, u.upgraded = !0, d.push({ type: "Upgraded" })) : (u.seals++, u.repaired = !0, d.push({ type: "Repaired" }));
			break;
		}
		case "chooseEvent":
			if (u.eventStatus !== "available" || u.eventId === null) return R(n, "unavailable");
			if (s.choice === "decline" && s.pieceId !== void 0) return R(n, "invalid_command");
			if (s.choice === "accept") {
				let e = I(u, s.pieceId);
				if (e.error) return R(n, e.error);
			}
			Y(u, s.choice, s.pieceId, d);
			break;
		case "settle": {
			u.eventStatus === "available" && Y(u, "decline", void 0, d);
			let e = N(u), t = {
				day: u.day,
				commissionId: E(u).id,
				met: e.complete,
				routeId: e.routeId,
				pieceIds: e.pieceIds,
				sales: u.daySales,
				recovered: u.dayRecovered + e.recovered,
				recoveredIds: e.remaining.map((e) => e.id),
				reserveId: u.reserveId,
				sealsBefore: u.seals,
				sealsAfter: e.sealsAfter,
				protected: e.protected,
				modification: null
			};
			for (let e of u.blades) t.recoveredIds.includes(e.id) && (e.status = "recycled", e.finalizedDay = u.day);
			u.coins += e.recovered, u.dayRecovered += e.recovered, u.seals = e.sealsAfter, e.protected && (u.pardonUsed = !0), u.history.push(t), u.phase = u.seals === 0 ? "defeat" : u.day === 12 ? u.history.filter((e) => e.met).length >= 10 && [
				4,
				8,
				12
			].every((e) => u.history.some((t) => t.day === e && t.met)) ? "victory" : "return" : u.day === 4 || u.day === 8 ? "chapter" : "summary", u.phase === "chapter" && (u.chapterChoices = u.day === 4 ? ["windbox", "warmRack"] : c.filter((e) => !u.modifications.includes(e))), d.push({
				type: "Settled",
				record: t
			});
			break;
		}
		case "chooseModification":
			if (!u.chapterChoices.includes(s.modification) || u.modifications.includes(s.modification)) return R(n, "unavailable");
			u.modifications.push(s.modification), u.history.at(-1).modification = s.modification, u.chapterChoices = [], u.phase = "summary", d.push({
				type: "Modification",
				modification: s.modification
			});
			break;
		case "advance": {
			let e = u.blades.find((e) => e.id === u.reserveId);
			e && u.modifications.includes("warmRack") && (e.value = w(e.value, 115), e.peak = Math.max(e.peak, e.value)), u.day++, u.phase = "workshop", u.daySales = 0, u.dayRecovered = 0, u.dayBuffs = L(u.pending), u.pending = L(z()), W(u), d.push({ type: "Advanced" });
			break;
		}
	}
	return u.revision++, u.journal.push(s), e({
		ok: !0,
		state: u,
		events: d
	});
}
//#endregion
//#region src/core-v4/validate.ts
function Z(e) {
	let n = r(e);
	if (!n) return {
		ok: !1,
		error: "invalid_state",
		detail: "Expected bounded plain JSON with safe integer fields."
	};
	let i = JSON.parse(n);
	if (!t(i) || i.rulesVersion !== "forge-v4") return {
		ok: !1,
		error: "invalid_rules_version",
		detail: "Expected forge-v4."
	};
	if (typeof i.runId != "string" || typeof i.seed != "string" || !Array.isArray(i.journal) || i.journal.length > 2048) return {
		ok: !1,
		error: "invalid_state",
		detail: "Missing identity or bounded Accepted journal."
	};
	let a = G({
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
		let n = X(o, {
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
function Q(e) {
	return [
		e.count > 1 ? `${e.count}柄各自合格` : "一柄",
		...e.recipe ? [u[e.recipe].name] : [],
		...e.crack ? [e.crack === "intact" ? "无裂纹" : "带裂纹"] : [],
		...e.age ? [e.age === "old" ? "昨日留剑" : "本日新剑"] : [],
		...e.maxHits === void 0 ? [] : [`普通锤≤${e.maxHits}`],
		...e.minLevel === void 0 ? [] : [`等级≥${e.minLevel}`],
		...e.minBursts === void 0 ? [] : [`连锻≥${e.minBursts}次`],
		`身价≥${e.value}`
	].join(" · ");
}
function $(t) {
	let n = t.history.filter((e) => [
		4,
		8,
		12
	].includes(e.day) && e.sealsAfter > 0).map((e) => x(e.day)), r = ["light"];
	n.includes(1) && r.push("guard"), n.includes(2) && r.push("heavy");
	let i = t.history.filter((e) => e.met).map((e) => ({
		commissionId: e.commissionId,
		day: e.day,
		routeId: e.routeId,
		blades: e.pieceIds.map((e) => t.blades.find((t) => t.id === e)),
		runId: t.runId
	})), a = s.filter((e) => i.some((t) => t.blades.some((t) => t.recipe === e && t.level >= 9))), o = [...new Set(t.journal.flatMap((e) => (e.type === "buy" || e.type === "claimGift") && e.traitId ? [e.traitId] : []))];
	return e({
		chapters: n,
		recipes: r,
		challenge: t.phase === "victory",
		mastery: a,
		traits: o,
		works: i
	});
}
function ee(t) {
	let n = E(t), r = j(t), i = t.phase === "workshop", o = t.journal.length < y, s = P(t), c = t.day < 12 ? {
		day: t.day + 1,
		commission: h[t.commissionOrder[t.day] - 1],
		normalBase: T(t, t.day + 1, t.pending.supplyPct),
		merchant: p.some((e) => e.day === t.day + 1),
		reserve: t.reserveId ? t.blades.filter((e) => e.id === t.reserveId).map((e) => ({
			id: e.id,
			value: t.modifications.includes("warmRack") ? w(e.value, 115) : e.value,
			cracked: e.cracked,
			charge: e.charge
		}))[0] ?? null : null
	} : null, l = [
		4,
		8,
		12
	].filter((e) => !t.history.some((t) => t.day === e && t.met));
	return e({
		rulesVersion: t.rulesVersion,
		revision: t.revision,
		phase: t.phase,
		day: t.day,
		chapter: f[x(t.day) - 1],
		mode: t.mode,
		coins: t.coins,
		seals: t.seals,
		commission: {
			...n,
			progress: r,
			routes: n.routes.map((e) => ({
				...e,
				description: Q(e)
			})),
			outcome: r.complete ? n.success : n.failure
		},
		recipes: D(t).map((e) => ({
			id: e,
			...u[e]
		})),
		recommendedRecipe: O(t),
		blades: t.blades.filter((e) => e.status === "active").map((e) => ({
			blade: e,
			reserved: e.id === t.reserveId,
			assessment: M(t, e),
			odds: k(t, e),
			recovery: S(e),
			willCommission: !r.complete && M(t, e).qualifies,
			canStrike: i && o && e.id !== t.reserveId && !C(e),
			canChangeRecipe: i && o && e.id !== t.reserveId && e.hits === 0
		})),
		traits: t.traits.map((e) => ({
			id: e,
			...a[e],
			used: e === "pardon" && t.pardonUsed
		})),
		modifications: t.modifications.map((e) => ({
			id: e,
			...d[e]
		})),
		chapterChoices: t.chapterChoices.map((e) => ({
			id: e,
			...d[e]
		})),
		growth: {
			supplyBase: t.supplyBase,
			upgradeCount: t.upgradeCount,
			inheritance: t.inheritance,
			crackGuard: t.crackGuard,
			dayBuffs: t.dayBuffs,
			pending: t.pending
		},
		event: t.eventId ? {
			id: t.eventId,
			...m[t.eventId],
			status: t.eventStatus,
			quote: I(t),
			canDecline: i && t.eventStatus === "available"
		} : null,
		merchant: F(t) && s ? {
			...s,
			offers: t.shop.map((e) => ({
				id: e,
				...a[e],
				sold: t.sold.includes(e),
				owned: t.traits.includes(e)
			})),
			canUpgrade: o && !t.upgraded && t.coins >= s.upgrade,
			canRepair: o && !t.repaired && t.seals < 3 && t.coins >= s.repair
		} : null,
		gift: {
			status: t.gift,
			canClaim: i && o && t.gift === "available"
		},
		next: c,
		settlement: N(t),
		canContinue: t.phase === "opening",
		canSettle: i,
		canAdvance: t.phase === "summary",
		ending: t.phase === "victory" || t.phase === "return" || t.phase === "defeat" ? {
			...g[t.phase],
			missingCritical: l,
			completed: t.history.filter((e) => e.met).length,
			finalBladeMade: t.history.some((e) => e.day === 12 && e.met)
		} : null,
		history: t.history,
		eventHistory: t.eventHistory,
		collection: $(t)
	});
}
//#endregion
export { f as CHAPTERS, h as COMMISSIONS, g as ENDINGS, m as EVENTS, l as EVENT_IDS, b as JOURNAL_LIMIT, y as JOURNAL_SOFT_LIMIT, v as LEVEL_CAP, p as MERCHANTS, d as MODIFICATIONS, c as MODIFICATION_IDS, u as RECIPES, s as RECIPE_IDS, a as TRAITS, _ as VALUE_CAP, X as applyCommand, M as assessBlade, C as atCap, x as chapterFor, E as commissionFor, j as commissionProgress, G as createRun, Q as describeRoute, I as eventQuote, $ as getCollectionAwards, ee as getRunView, P as merchantFor, F as merchantPresent, K as parseAction, w as percent, O as recommendedRecipe, S as recovery, A as routeAssessment, N as settlementPreview, k as strikeOdds, T as supplyBaseFor, D as unlockedRecipes, Z as validateRun };
