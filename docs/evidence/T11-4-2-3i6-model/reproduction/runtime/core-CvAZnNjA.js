//#region src/core/immutable.ts
function e(t) {
	if (typeof t != "object" || !t || Object.isFrozen(t)) return t;
	let n = Array.isArray(t) ? t.map((t) => e(t)) : Object.fromEntries(Object.entries(t).map(([t, n]) => [t, e(n)]));
	return Object.freeze(n);
}
//#endregion
//#region src/core/rules.ts
var t = "forge-v1", n = e([
	120,
	150,
	180,
	210,
	250,
	290,
	340,
	390,
	450,
	520,
	600,
	700
]), r = e([
	3,
	6,
	9
]), i = e([
	{
		name: "粗坯",
		progress: 0,
		multiplier: 10
	},
	{
		name: "整形",
		progress: 2,
		multiplier: 16
	},
	{
		name: "淬炼",
		progress: 5,
		multiplier: 25
	},
	{
		name: "成刃",
		progress: 9,
		multiplier: 38
	},
	{
		name: "精工",
		progress: 14,
		multiplier: 56
	},
	{
		name: "上品",
		progress: 20,
		multiplier: 80
	},
	{
		name: "名作",
		progress: 27,
		multiplier: 115
	},
	{
		name: "传世",
		progress: 35,
		multiplier: 160
	}
]), a = e({
	iron: {
		name: "熟铁",
		baseValue: 18,
		integrity: 4,
		risk: 2,
		scrap: 3
	},
	steel: {
		name: "精钢",
		baseValue: 22,
		integrity: 3,
		risk: 6,
		scrap: 4
	},
	meteorite: {
		name: "陨铁",
		baseValue: 28,
		integrity: 2,
		risk: 10,
		scrap: 5
	}
}), o = e({
	light: {
		label: "轻锤",
		progress: 1,
		heat: 8,
		stress: 3,
		risk: -2,
		periodMs: 1600
	},
	standard: {
		label: "标准锤",
		progress: 2,
		heat: 12,
		stress: 7,
		risk: 2,
		periodMs: 1400
	},
	heavy: {
		label: "重锤",
		progress: 3,
		heat: 18,
		stress: 12,
		risk: 7,
		periodMs: 1200
	}
});
function s(e) {
	return e === "light" || e === "standard" || e === "heavy";
}
function c(e) {
	return e === "handle" || e === "bellows" || e === "anvil" || e === "repair";
}
function l(e) {
	let t = 0;
	for (let [n, r] of i.entries()) e >= r.progress && (t = n);
	return t;
}
function u(e) {
	let t = i[e];
	if (!t) throw Error("Internal tier index outside rules table");
	return t;
}
function d(e) {
	let t = n[e - 1];
	if (t === void 0) throw Error("Internal round outside contract");
	return t;
}
function f(e) {
	return Math.floor(a[e.material].baseValue * u(l(e.progress)).multiplier / 10);
}
function p(e) {
	return a[e.material].scrap + Math.floor(l(e.progress) / 2);
}
function m(e, t) {
	let n = Math.abs(e - 5e3);
	return n <= 600 + 200 * t ? "precise" : n <= 2e3 ? "ordinary" : "mishit";
}
function h(e, t, n, r) {
	let i = n === "precise" ? -6 : n === "mishit" ? 12 : 0, s = Math.ceil(Math.max(0, 40 - e.heat) / 10) * 4, c = a[e.material].risk + l(e.progress) * 3 + o[t].risk + i + s + Math.floor(e.stress / 20) * 3 - r * 3;
	return Math.max(0, Math.min(85, c));
}
function g(e) {
	return e.pieces.reduce((e, t) => e + (t.status === "delivered" ? f(t) : 0), 0);
}
//#endregion
//#region src/core/guards.ts
function _(e) {
	return typeof e == "object" && !!e && !Array.isArray(e);
}
function v(e) {
	return e === null ? { allowed: !0 } : {
		allowed: !1,
		reason: e
	};
}
function y(e, t, n) {
	if (e.phase !== "workshop") return "wrong_phase";
	if (!t) return "piece_not_found";
	if (t.status !== "active") return "piece_finalized";
	if (n === "strike") {
		if (t.progress >= 35) return "max_progress";
		if (t.heat <= 0) return "no_heat";
	}
	if (n === "heat") {
		if (t.heat >= 100) return "already_hot";
		if (e.coal <= 0) return "no_coal";
	}
	return null;
}
function b(e, t) {
	return e.phase === "workshop" ? !t && e.pieces.some((e) => e.status === "active") ? "unprocessed_pieces" : null : "wrong_phase";
}
function x(e) {
	if (!_(e)) return {
		ok: !1,
		error: "invalid_command"
	};
	switch (e.type) {
		case "strike": return typeof e.pieceId == "string" ? s(e.mode) ? typeof e.timingMark != "number" || !Number.isInteger(e.timingMark) || e.timingMark < 0 || e.timingMark > 1e4 ? {
			ok: !1,
			error: "invalid_timing"
		} : {
			ok: !0,
			action: {
				type: "strike",
				pieceId: e.pieceId,
				mode: e.mode,
				timingMark: e.timingMark
			}
		} : {
			ok: !1,
			error: "invalid_hammer"
		} : {
			ok: !1,
			error: "invalid_command"
		};
		case "heat":
		case "deliver":
		case "recycle": return typeof e.pieceId == "string" ? {
			ok: !0,
			action: {
				type: e.type,
				pieceId: e.pieceId
			}
		} : {
			ok: !1,
			error: "invalid_command"
		};
		case "settleRound": return typeof e.recycleRemaining == "boolean" ? {
			ok: !0,
			action: {
				type: "settleRound",
				recycleRemaining: e.recycleRemaining
			}
		} : {
			ok: !1,
			error: "invalid_command"
		};
		case "buy": return c(e.productId) ? {
			ok: !0,
			action: {
				type: "buy",
				productId: e.productId
			}
		} : {
			ok: !1,
			error: "invalid_product"
		};
		case "advanceSummary":
		case "leaveMerchant": return {
			ok: !0,
			action: { type: e.type }
		};
		default: return {
			ok: !1,
			error: "invalid_command"
		};
	}
}
//#endregion
//#region src/core/random.ts
function S(e) {
	let t = 2166136261;
	for (let n of new TextEncoder().encode(e)) t = Math.imul(t ^ n, 16777619) >>> 0;
	return t;
}
function C(e) {
	let t = e.state + 1831565813 >>> 0, n = Math.imul(t ^ t >>> 15, t | 1);
	return n ^= n + Math.imul(n ^ n >>> 7, n | 61), {
		value: ((n ^ n >>> 14) >>> 0) / 4294967296,
		stream: {
			state: t,
			draws: e.draws + 1
		}
	};
}
function w(e, t) {
	return {
		state: S(`${e}|${t}`),
		draws: 0
	};
}
//#endregion
//#region src/core/merchant.ts
var T = e({
	handle: {
		label: "配重锤柄",
		effect: "精准区每级向两侧各扩大 2 个百分点",
		prices: [{
			coins: 100,
			scrap: 3
		}, {
			coins: 180,
			scrap: 5
		}]
	},
	bellows: {
		label: "强化风箱",
		effect: "每级令下一轮煤炭配给 +1",
		prices: [{
			coins: 120,
			scrap: 4
		}, {
			coins: 220,
			scrap: 6
		}]
	},
	anvil: {
		label: "稳固砧台",
		effect: "每级裂损概率 -3 个百分点",
		prices: [{
			coins: 160,
			scrap: 6
		}, {
			coins: 260,
			scrap: 8
		}]
	},
	repair: {
		label: "契约修补",
		effect: "恢复一枚契约印记，本次来访限一次",
		prices: [{
			coins: 240,
			scrap: 6
		}]
	}
}), E = e([
	"handle",
	"bellows",
	"anvil",
	"repair"
]);
function D(e, t) {
	let n = T[t], r = e.purchases.some((n) => n.afterRound === e.round && n.product === t), i = t === "repair" ? +!!r : e.upgrades[t], a = n.prices[t === "repair" ? 0 : i] ?? null, o = e.phase === "merchant" ? r ? "already_purchased" : a === null ? "max_level" : t === "repair" && e.seals >= 3 ? "repair_not_needed" : e.coins < a.coins ? "insufficient_coins" : e.scrap < a.scrap ? "insufficient_scrap" : null : "wrong_phase";
	return {
		productId: t,
		label: n.label,
		effect: n.effect,
		level: i,
		nextLevel: a === null || t === "repair" && r ? null : t === "repair" ? 1 : i + 1,
		price: a,
		availability: v(o)
	};
}
//#endregion
//#region src/core/game.ts
var O = Object.freeze([]);
function k() {
	return {
		strikes: 0,
		successfulStrikes: 0,
		damagedStrikes: 0,
		heats: 0,
		deliveredPieces: 0,
		recycledPieces: 0,
		brokenPieces: 0,
		highestTier: 0,
		coinsEarned: 0,
		coinsSpent: 0,
		scrapEarned: 0,
		scrapSpent: 0,
		roundsMet: 0,
		roundsMissed: 0
	};
}
function A(e, t, n) {
	return {
		id: `${e}:${t}`,
		material: n,
		progress: 0,
		heat: 100,
		stress: 0,
		integrity: a[n].integrity,
		status: "active"
	};
}
function j(e, t) {
	return [
		A(e, 1, t[0]),
		A(e, 2, t[1]),
		A(e, 3, t[2])
	];
}
function M(e, t) {
	let [n, r, i] = e.pieces;
	return [
		n.id === t.id ? t : n,
		r.id === t.id ? t : r,
		i.id === t.id ? t : i
	];
}
function N(n) {
	if (!_(n) || typeof n.runId != "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(n.runId)) return {
		ok: !1,
		error: "invalid_run_id"
	};
	if (typeof n.seed != "string") return {
		ok: !1,
		error: "invalid_seed"
	};
	let r = n.seed.normalize("NFC").trim();
	return Array.from(r).length < 1 || Array.from(r).length > 64 ? {
		ok: !1,
		error: "invalid_seed"
	} : e({
		ok: !0,
		state: {
			rulesVersion: t,
			runId: n.runId,
			seed: r,
			revision: 0,
			phase: "workshop",
			round: 1,
			coins: 0,
			scrap: 0,
			coal: 1,
			seals: 3,
			upgrades: {
				handle: 0,
				bellows: 0,
				anvil: 0
			},
			pieces: j(1, [
				"iron",
				"iron",
				"steel"
			]),
			rng: {
				stock: w(r, "stock"),
				strike: w(r, "strike")
			},
			history: [],
			purchases: [],
			stats: k(),
			journal: []
		}
	});
}
function P(e, t) {
	return {
		ok: !1,
		state: e,
		error: t,
		events: O
	};
}
function F(t, n, r) {
	return e({
		ok: !0,
		state: {
			...n,
			revision: t.revision + 1
		},
		events: r
	});
}
function I(e, t) {
	let n = p(t);
	return {
		state: {
			...e,
			scrap: e.scrap + n,
			pieces: M(e, {
				...t,
				status: "recycled"
			}),
			stats: {
				...e.stats,
				recycledPieces: e.stats.recycledPieces + 1,
				scrapEarned: e.stats.scrapEarned + n
			}
		},
		event: {
			type: "PieceRecycled",
			pieceId: t.id,
			scrap: n
		}
	};
}
function L(e) {
	let t = e.round + 1, n = C(e.rng.stock), r = n.value < .35 ? "iron" : n.value < .8 ? "steel" : "meteorite", i = 1 + e.upgrades.bellows;
	return {
		state: {
			...e,
			round: t,
			phase: "workshop",
			coal: i,
			pieces: j(t, [
				"iron",
				"steel",
				r
			]),
			rng: {
				...e.rng,
				stock: n.stream
			}
		},
		event: {
			type: "RoundStarted",
			round: t,
			quota: d(t),
			coal: i
		}
	};
}
function R(e, t) {
	let n = b(e, t);
	if (n) return P(e, n);
	let r = e, i = [];
	for (let t of e.pieces) if (t.status === "active") {
		let e = I(r, t);
		r = e.state, i.push(e.event);
	}
	let a = d(e.round), o = g(r), s = o >= a, c = e.seals - +!s, l = c === 0 ? "defeat" : e.round === 12 ? "victory" : "roundSummary", u = {
		round: e.round,
		quota: a,
		delivered: o,
		deficit: Math.max(0, a - o),
		metQuota: s,
		sealsBefore: e.seals,
		sealsAfter: c,
		coalRemaining: r.coal,
		pieces: r.pieces
	};
	return r = {
		...r,
		phase: l,
		seals: c,
		history: [...e.history, u],
		stats: {
			...r.stats,
			roundsMet: e.stats.roundsMet + +!!s,
			roundsMissed: e.stats.roundsMissed + +!s
		}
	}, i.push({
		type: "RoundSettled",
		summary: u
	}), (l === "victory" || l === "defeat") && i.push({
		type: "RunEnded",
		outcome: l,
		round: e.round,
		seals: c
	}), F(e, r, i);
}
function z(e, t) {
	let n = e.pieces.find((e) => e.id === t.pieceId), r = y(e, n, t.type);
	if (r) return P(e, r);
	if (!n) return P(e, "piece_not_found");
	switch (t.type) {
		case "heat": return F(e, {
			...e,
			coal: e.coal - 1,
			pieces: M(e, {
				...n,
				heat: 100,
				stress: Math.min(100, n.stress + 5)
			}),
			stats: {
				...e.stats,
				heats: e.stats.heats + 1
			}
		}, [{
			type: "Heated",
			pieceId: n.id,
			coalSpent: 1
		}]);
		case "deliver": {
			let t = f(n);
			return F(e, {
				...e,
				coins: e.coins + t,
				pieces: M(e, {
					...n,
					status: "delivered"
				}),
				stats: {
					...e.stats,
					deliveredPieces: e.stats.deliveredPieces + 1,
					coinsEarned: e.stats.coinsEarned + t
				}
			}, [{
				type: "PieceDelivered",
				pieceId: n.id,
				value: t
			}]);
		}
		case "recycle": {
			let t = I(e, n);
			return F(e, t.state, [t.event]);
		}
		case "strike": {
			let r = m(t.timingMark, e.upgrades.handle), i = h(n, t.mode, r, e.upgrades.anvil), a = C(e.rng.strike), s = a.value < i / 100, c = o[t.mode], u = s ? n.progress : Math.min(35, n.progress + c.progress + +(r === "precise")), d = n.integrity - +!!s, p = d === 0, g = {
				...n,
				progress: u,
				integrity: d,
				heat: Math.max(0, n.heat - c.heat),
				stress: Math.min(100, n.stress + c.stress + (s ? 6 : 0)),
				status: p ? "broken" : "active"
			}, _ = l(n.progress), v = l(u), y = [{
				type: "StrikeResolved",
				pieceId: n.id,
				mode: t.mode,
				timing: r,
				timingMark: t.timingMark,
				damageRiskPct: i,
				breakRiskPct: n.integrity === 1 ? i : 0,
				outcome: p ? "broken" : s ? "damage" : "success",
				progressGained: u - n.progress,
				heatBefore: n.heat,
				heatAfter: g.heat,
				stressBefore: n.stress,
				stressAfter: g.stress
			}];
			return v > _ && y.push({
				type: "TierRaised",
				pieceId: n.id,
				from: _,
				to: v,
				valueBefore: f(n),
				valueAfter: f(g)
			}), p && y.push({
				type: "PieceBroken",
				pieceId: n.id,
				lostValue: f(n),
				scrap: 1
			}), F(e, {
				...e,
				pieces: M(e, g),
				scrap: e.scrap + +!!p,
				rng: {
					...e.rng,
					strike: a.stream
				},
				stats: {
					...e.stats,
					strikes: e.stats.strikes + 1,
					successfulStrikes: e.stats.successfulStrikes + +!s,
					damagedStrikes: e.stats.damagedStrikes + +!!s,
					brokenPieces: e.stats.brokenPieces + +!!p,
					highestTier: Math.max(e.stats.highestTier, v),
					scrapEarned: e.stats.scrapEarned + +!!p
				}
			}, y);
		}
	}
}
function B(t, n) {
	if (t.rulesVersion !== "forge-v1") return P(t, "invalid_rules_version");
	if (!_(n) || typeof n.runId != "string" || !Number.isSafeInteger(n.expectedRevision)) return P(t, "invalid_command");
	if (n.runId !== t.runId) return P(t, "foreign_run");
	if (n.expectedRevision !== t.revision) return P(t, "stale_revision");
	let r = x(n.action);
	if (!r.ok) return P(t, r.error);
	let i = V(t, r.action);
	return i.ok ? e({
		...i,
		state: {
			...i.state,
			journal: [...t.journal, r.action]
		}
	}) : i;
}
function V(e, t) {
	switch (t.type) {
		case "buy": {
			let n = D(e, t.productId);
			if (!n.availability.allowed) return P(e, n.availability.reason);
			if (!n.price) return P(e, "max_level");
			let r = {
				afterRound: e.round,
				product: t.productId,
				level: t.productId === "repair" ? 1 : e.upgrades[t.productId] + 1,
				coins: n.price.coins,
				scrap: n.price.scrap
			};
			return F(e, {
				...e,
				coins: e.coins - r.coins,
				scrap: e.scrap - r.scrap,
				seals: t.productId === "repair" ? e.seals + 1 : e.seals,
				upgrades: t.productId === "repair" ? e.upgrades : {
					...e.upgrades,
					[t.productId]: r.level
				},
				purchases: [...e.purchases, r],
				stats: {
					...e.stats,
					coinsSpent: e.stats.coinsSpent + r.coins,
					scrapSpent: e.stats.scrapSpent + r.scrap
				}
			}, [{
				type: "PurchaseMade",
				purchase: r
			}]);
		}
		case "settleRound": return R(e, t.recycleRemaining);
		case "advanceSummary": {
			if (e.phase !== "roundSummary") return P(e, "wrong_phase");
			if (r.includes(e.round)) return F(e, {
				...e,
				phase: "merchant"
			}, [{
				type: "MerchantEntered",
				afterRound: e.round
			}]);
			let t = L(e);
			return F(e, t.state, [t.event]);
		}
		case "leaveMerchant": {
			if (e.phase !== "merchant") return P(e, "wrong_phase");
			let t = L(e);
			return F(e, t.state, [t.event]);
		}
		default: return z(e, t);
	}
}
//#endregion
//#region src/core/view.ts
var H = [
	"precise",
	"ordinary",
	"mishit"
];
function U(e, t, n) {
	let r = l(t.progress), i = r < 7 ? u(r + 1) : null;
	return {
		...t,
		materialName: a[t.material].name,
		maxIntegrity: a[t.material].integrity,
		tier: r,
		tierName: u(r).name,
		forgedValue: f(t),
		deliveredValue: t.status === "delivered" ? f(t) : 0,
		nextProgress: i?.progress ?? null,
		nextValue: i ? Math.floor(a[t.material].baseValue * i.multiplier / 10) : null,
		recoverableScrap: t.status === "active" ? p(t) : 0,
		recoveredScrap: t.status === "recycled" ? p(t) : +(t.status === "broken"),
		risk: t.status === "active" ? H.map((r) => {
			let i = h(t, n, r, e.upgrades.anvil);
			return {
				grade: r,
				damageRiskPct: i,
				breakRiskPct: t.integrity === 1 ? i : 0,
				progressOnSuccess: Math.min(35 - t.progress, o[n].progress + +(r === "precise"))
			};
		}) : [],
		actions: {
			strike: v(y(e, t, "strike")),
			heat: v(y(e, t, "heat")),
			deliver: v(y(e, t, "deliver")),
			recycle: v(y(e, t, "recycle"))
		}
	};
}
function W(t, n = {}) {
	let i = s(n.mode) ? n.mode : "standard", a = o[i], c = t.pieces.map((e) => U(t, e, i)), l = (n.pieceId ? c.find((e) => e.id === n.pieceId) : void 0) ?? c.find((e) => e.status === "active") ?? null, u = d(t.round), f = g(t), p = t.phase === "victory" || t.phase === "defeat" ? null : r.find((e) => t.phase === "merchant" ? e > t.round : e >= t.round) ?? null;
	return e({
		runId: t.runId,
		revision: t.revision,
		phase: t.phase,
		round: t.round,
		totalRounds: 12,
		quota: u,
		delivered: f,
		remaining: Math.max(0, u - f),
		coins: t.coins,
		scrap: t.scrap,
		coal: t.coal,
		seals: t.seals,
		upgrades: t.upgrades,
		mode: i,
		hammer: {
			label: a.label,
			progress: a.progress,
			preciseProgress: a.progress + 1,
			heatCost: a.heat,
			stressCost: a.stress,
			periodMs: a.periodMs
		},
		timingBands: {
			center: 5e3,
			preciseHalfWidth: 600 + 200 * t.upgrades.handle,
			ordinaryHalfWidth: 2e3
		},
		pieces: c,
		selected: l,
		nextMerchantRound: p,
		actions: {
			settle: v(b(t, !1)),
			closeEarly: v(b(t, !0)),
			advance: v(t.phase === "roundSummary" ? null : "wrong_phase"),
			leaveMerchant: v(t.phase === "merchant" ? null : "wrong_phase")
		},
		history: t.history,
		stats: t.stats,
		purchases: t.purchases,
		merchant: {
			active: t.phase === "merchant",
			offers: E.map((e) => D(t, e))
		}
	});
}
//#endregion
//#region src/core/ledger.ts
var G = {
	active: "加工中",
	delivered: "已交货",
	recycled: "已回收",
	broken: "已破碎"
};
function K(e) {
	return {
		id: e.id,
		material: a[e.material].name,
		tier: u(l(e.progress)).name,
		status: G[e.status],
		statusCode: e.status,
		value: f(e),
		coins: e.status === "delivered" ? f(e) : 0,
		scrap: e.status === "broken" ? 1 : e.status === "recycled" ? p(e) : 0,
		lost: e.status === "broken" ? f(e) : 0
	};
}
function q(e) {
	let t = e.pieces.map(K);
	return {
		...e,
		pieces: t,
		scrap: t.reduce((e, t) => e + t.scrap, 0),
		lost: t.reduce((e, t) => e + t.lost, 0)
	};
}
function J(t) {
	let n = t.history.map(q);
	return e({
		rounds: n,
		highestTier: u(t.stats.highestTier).name,
		lost: n.reduce((e, t) => e + t.lost, 0),
		purchases: t.purchases.map((e) => ({
			...e,
			label: t.merchant.offers.find((t) => t.productId === e.product)?.label ?? e.product
		}))
	});
}
//#endregion
//#region src/core/validate.ts
var Y = 262144, X = 2048;
function Z(e) {
	let t = 0, n = 0, r = (e, i) => {
		if (++t > 5e4 || i > 16) return null;
		if (e === null || typeof e == "boolean" || typeof e == "number" && Number.isSafeInteger(e)) {
			let t = JSON.stringify(e);
			return n += t.length, n <= 262144 ? t : null;
		}
		if (typeof e == "string") {
			if (e.length > 262144) return null;
			let t = JSON.stringify(e);
			return n += t.length, n <= 262144 ? t : null;
		}
		if (typeof e != "object") return null;
		let a = Array.isArray(e), o = Object.getPrototypeOf(e);
		if (a ? o !== Array.prototype : o !== Object.prototype && o !== null) return null;
		let s = Reflect.ownKeys(e);
		if (s.some((e) => typeof e != "string") || s.length > 1e4) return null;
		let c = [];
		if (a) {
			if (e.length > 2048 || s.length !== e.length + 1) return null;
			for (let t = 0; t < e.length; t++) {
				let n = Object.getOwnPropertyDescriptor(e, String(t));
				if (!n || !("value" in n) || !n.enumerable) return null;
				let a = n.value, o = r(a, i + 1);
				if (o === null) return null;
				c.push(o);
			}
			return `[${c.join(",")}]`;
		}
		let l = Object.getOwnPropertyNames(e).sort();
		for (let t of l) {
			let a = Object.getOwnPropertyDescriptor(e, t);
			if (!a || !("value" in a) || !a.enumerable || (n += t.length + 3, n > 262144)) return null;
			let o = a.value, s = r(o, i + 1);
			if (s === null) return null;
			c.push(`${JSON.stringify(t)}:${s}`);
		}
		return `{${c.join(",")}}`;
	};
	try {
		let t = r(e, 0);
		return t !== null && new TextEncoder().encode(t).byteLength <= 262144 ? t : null;
	} catch {
		return null;
	}
}
function Q(e, n = t) {
	let r = Z(e);
	if (r === null) return {
		ok: !1,
		error: "invalid_state",
		detail: "State must be bounded plain JSON data with finite safe integers."
	};
	let i = JSON.parse(r);
	if (!_(i)) return {
		ok: !1,
		error: "invalid_state",
		detail: "State must be an object."
	};
	if (typeof i.rulesVersion != "string") return {
		ok: !1,
		error: "invalid_state",
		detail: "State rules version is missing."
	};
	if (n !== "forge-v1" || i.rulesVersion !== n) return {
		ok: !1,
		error: "invalid_rules_version",
		detail: "Rules version does not match the installed rules."
	};
	if (typeof i.runId != "string" || typeof i.seed != "string") return {
		ok: !1,
		error: "invalid_state",
		detail: "Run identity and seed are required."
	};
	if (!Array.isArray(i.journal) || i.journal.length > 2048) return {
		ok: !1,
		error: "invalid_journal",
		detail: "A bounded command journal is required."
	};
	let a = N({
		runId: i.runId,
		seed: i.seed
	});
	if (!a.ok) return {
		ok: !1,
		error: "invalid_state",
		detail: a.error
	};
	let o = a.state;
	for (let [e, t] of i.journal.entries()) {
		let n = x(t);
		if (!n.ok) return {
			ok: !1,
			error: "invalid_journal",
			detail: `Command ${e}: ${n.error}`
		};
		let r = B(o, {
			runId: o.runId,
			expectedRevision: o.revision,
			action: n.action
		});
		if (!r.ok) return {
			ok: !1,
			error: "invalid_journal",
			detail: `Command ${e}: ${r.error}`
		};
		o = r.state;
	}
	return Z(o) === r ? {
		ok: !0,
		state: o
	} : {
		ok: !1,
		error: "invalid_state",
		detail: "State does not match its seed and accepted-command journal."
	};
}
//#endregion
export { J as a, N as c, _ as d, t as f, Q as i, S as l, Y as n, W as o, e as p, Z as r, B as s, X as t, C as u };
