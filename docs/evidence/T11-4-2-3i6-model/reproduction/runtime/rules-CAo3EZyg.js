//#region src/core-v3/rules.ts
var e = Object.freeze({
	steady: {
		name: "稳手护符",
		text: "首次裂损保住身价，剑仍会留下裂纹。"
	},
	ember: {
		name: "炉心余烬",
		text: "连锻多一记安全锤。"
	},
	inherit: {
		name: "余温铁夹",
		text: "碎剑峰值的20%传给下轮第一柄，最多增加普通底价的4倍。"
	},
	echo: {
		name: "回响锤纹",
		text: "每第三次普通成功，身价额外增长25%。"
	},
	crackedEdge: {
		name: "裂锋印",
		text: "裂纹剑的大成率增加10个百分点，裂损率不变。"
	},
	pardon: {
		name: "护炉契",
		text: "本局首次失约免扣印记；卸下再装备也不会恢复次数。"
	}
}), t = Object.keys(e), n = [
	180,
	300,
	520,
	850,
	1400,
	2300,
	3800,
	6200,
	1e4,
	16e3,
	26e3,
	42e3
], r = 1e9, i = (e) => n[e - 1] ?? n[11], a = (e) => Math.floor(e.base / 4), o = (e) => e.value >= 1e9 || e.level >= 99, s = (e) => e.phase === "workshop" && [
	3,
	6,
	9
].includes(e.round), c = (e) => e === 3 ? 180 : e === 6 ? 900 : 4500;
function l(e, t) {
	let n = [
		0,
		0,
		0,
		50,
		80,
		120,
		180,
		240,
		300,
		360,
		420,
		480,
		500
	][Math.min(12, t.hits)] ?? 500, r = t.charge === 6, i = r ? 350 : 150 + (t.cracked && e.traits.includes("crackedEdge") ? 100 : 0);
	return {
		burst: r,
		crack: r ? 0 : n,
		great: i,
		success: 1e3 - i - (r ? 0 : n),
		afterBurstCrack: n
	};
}
function u(e) {
	let t = e.blades.filter((t) => t.status === "active" && t.id !== e.reserveId), n = e.delivered >= i(e.round), r = !n && e.traits.includes("pardon") && !e.pardonUsed;
	return {
		remaining: t,
		recovered: t.reduce((e, t) => e + a(t), 0),
		met: n,
		protected: r,
		sealsAfter: e.seals - (n || r ? 0 : 1)
	};
}
//#endregion
export { o as a, a as c, c as d, r as i, u as l, e as n, s as o, t as r, i as s, n as t, l as u };
