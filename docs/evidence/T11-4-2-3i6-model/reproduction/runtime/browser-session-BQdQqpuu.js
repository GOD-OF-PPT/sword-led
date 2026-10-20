import { c as e, d as t, f as n, i as r, p as i, s as a } from "./core-CvAZnNjA.js";
//#region src/application/persistent-session.ts
function o(t, n) {
	return s(t, n, {
		createRun: e,
		applyCommand: a
	});
}
function s(e, t, n) {
	let r = n.isTerminal ?? ((e) => e.phase === "victory" || e.phase === "defeat"), a = 0, o = 0, s = "inactive", c = !1, l = null, u = !1, d = !1, f = null, p = null, m, h = /* @__PURE__ */ new Set(), g = () => i({
		generation: a,
		mode: s,
		active: c,
		state: l,
		dirty: u,
		conflict: d,
		load: f,
		lastSave: p
	}), _ = () => {
		let e = g();
		for (let t of h) try {
			t(e);
		} catch {}
	}, v = (e) => ({
		ok: !1,
		error: e,
		snapshot: g()
	}), y = () => ({
		ok: !0,
		snapshot: g()
	}), b = () => {
		a++, o++;
	}, x = () => {
		d = !0, u = l !== null, b(), _();
	}, S = (e) => e.main.status === "valid" && !r(e.main.state) || e.main.status === "invalid" || e.main.status === "empty" && e.backup.status === "valid", C = (e, n = !1) => s === "disposed" ? "disposed" : e === a ? c ? s === "memory" ? null : s === "unsupported" ? "locks_unsupported" : s !== "writer" || !t.owns() ? "readonly" : d && !n ? "save_conflict" : null : "not_active" : "stale_session", w = () => l === null || s === "memory" ? (u = l !== null, p = null, null) : (p = t.owns() ? e.write(l, { raw: m }) : {
		ok: !1,
		error: "storage_conflict",
		detail: "Writer lease was lost."
	}, u = !p.ok, p.ok && (m = e.token()), !p.ok && p.error === "storage_conflict" && (d = !0), p);
	return {
		getSnapshot: g,
		subscribe: (e) => {
			h.add(e);
			try {
				e(g());
			} catch {}
			return () => {
				h.delete(e);
			};
		},
		activate: async () => {
			if (s === "disposed") return g();
			let n = ++o;
			if (a++, s === "memory") return c = !0, _(), g();
			c = !1;
			let r = l, i = u, h = m, v = await t.acquire();
			return n === o && (c = v !== "cancelled" && v !== "disposed", s = v === "writer" ? "writer" : v === "readonly" ? "readonly" : v === "unsupported" ? "unsupported" : "error", f = e.load(), r && (i || f.main.status !== "valid") ? (l = r, u = !0, d = h !== e.token()) : (l = f.main.status === "valid" ? f.main.state : null, m = e.token(), u = !1, d = !1), p = null, _()), g();
		},
		startNewGame: (t, i) => {
			let a = C(i.generation, !0);
			if (a) return v(a);
			let o = n.createRun(t);
			if (!o.ok) return v(o.error);
			if (s === "memory") {
				if (l && i.confirmed !== !0) return v("confirmation_required");
			} else {
				let t = e.inspect();
				if (t.main.status === "unavailable") return v("save_unavailable");
				let n = l !== null && !r(l);
				if ((S(t) || n || u) && i.confirmed !== !0) return v("confirmation_required");
				if (f = e.load(), f.main.status === "unavailable") return x(), v("save_unavailable");
				if (S(f) && i.confirmed !== !0) return x(), v("confirmation_required");
			}
			return b(), l = o.state, m = s === "memory" ? void 0 : e.token(), u = !0, d = !1, w(), _(), y();
		},
		resume: (t) => {
			let n = C(t.generation, !0);
			return n ? v(n) : s === "memory" ? v("save_unavailable") : u && t.confirmed !== !0 ? v("confirmation_required") : e.inspect().main.status === "valid" ? (f = e.load(), f.main.status === "valid" ? (l = f.main.state, m = e.token(), u = !1, d = !1, p = null, b(), _(), y()) : (x(), v("save_unavailable"))) : v("save_unavailable");
		},
		recoverBackup: (t) => {
			let n = C(t.generation, !0);
			if (n) return v(n);
			if (s === "memory") return v("save_unavailable");
			if (t.confirmed !== !0) return v("confirmation_required");
			let r = e.inspect();
			return r.main.status === "valid" ? v("main_available") : r.main.status === "unavailable" || r.backup.status !== "valid" ? v("backup_unavailable") : (f = e.load(), f.main.status === "valid" ? (x(), v("main_available")) : f.main.status === "unavailable" || f.backup.status !== "valid" ? (x(), v("backup_unavailable")) : (l = f.backup.state, m = e.token(), d = !1, u = !0, b(), w(), _(), y()));
		},
		useMemory: (e, r) => {
			if (s === "disposed") return v("disposed");
			if (r.generation !== a) return v("stale_session");
			if (e !== null && l && r.confirmed !== !0) return v("confirmation_required");
			let i = e === null ? null : n.createRun(e);
			return i && !i.ok ? v(i.error) : !i && !l ? v("no_run") : (b(), t.release(), i?.ok && (l = i.state), m = void 0, s = "memory", c = !0, u = !0, d = !1, p = null, _(), y());
		},
		dispatch: (e, t) => {
			let r = C(t);
			if (r || l === null) return {
				ok: !1,
				state: l,
				error: r ?? "no_run",
				events: [],
				snapshot: g()
			};
			let i = n.applyCommand(l, e);
			if (!i.ok) return {
				...i,
				snapshot: g()
			};
			l = i.state, u = !0;
			let a = w();
			return _(), {
				...i,
				persistence: a,
				snapshot: g()
			};
		},
		retrySave: (e) => {
			let t = C(e);
			return t ? v(t) : s === "memory" ? v("save_unavailable") : l ? (u && (w(), _()), u ? v(d ? "save_conflict" : "save_unavailable") : y()) : v("no_run");
		},
		notifyExternalChange: () => {
			s !== "disposed" && s !== "memory" && (e.isCurrent({ raw: m }) || (d = !0, a++), _());
		},
		suspend: () => {
			b(), c = !1, s !== "disposed" && s !== "memory" && (s = "inactive");
			let e = t.release();
			return _(), e;
		},
		dispose: () => {
			b(), c = !1, s = "disposed";
			let e = t.dispose();
			return _(), h.clear(), e;
		}
	};
}
//#endregion
//#region src/platform/storage.ts
var c = "sword-led.save.v1", l = "sword-led.save.backup.v1", u = {
	key: c,
	backupKey: l,
	schemaVersion: 1,
	rulesVersion: n,
	validate: (e) => r(e)
};
function d(e) {
	if (typeof e != "string" || e.length !== 24) return !1;
	try {
		return new Date(e).toISOString() === e;
	} catch {
		return !1;
	}
}
function f(e) {
	return p(e, u);
}
function p(e, n) {
	if (e === null) return { status: "empty" };
	if (e.length > 262144 || new TextEncoder().encode(e).byteLength > 262144) return {
		status: "invalid",
		error: "save_too_large",
		detail: "Save exceeds 256 KiB."
	};
	let r;
	try {
		r = JSON.parse(e);
	} catch {
		return {
			status: "invalid",
			error: "invalid_json",
			detail: "Save is not valid JSON."
		};
	}
	if (!t(r) || Object.keys(r).sort().join(",") !== "rulesVersion,savedAt,schemaVersion,state" || r.schemaVersion !== n.schemaVersion) return {
		status: "invalid",
		error: "unsupported_schema",
		detail: "Unsupported save envelope/schema."
	};
	if (r.rulesVersion !== n.rulesVersion) return {
		status: "invalid",
		error: "unsupported_rules",
		detail: "Save uses different rules."
	};
	if (!d(r.savedAt)) return {
		status: "invalid",
		error: "invalid_timestamp",
		detail: "Invalid save timestamp."
	};
	let i = n.validate(r.state);
	return i.ok ? {
		status: "valid",
		state: i.state,
		savedAt: r.savedAt
	} : {
		status: "invalid",
		error: i.error === "invalid_rules_version" ? "unsupported_rules" : "invalid_state",
		detail: i.detail
	};
}
function m(e, t = () => (/* @__PURE__ */ new Date()).toISOString()) {
	return h(e, u, t);
}
function h(e, t, n = () => (/* @__PURE__ */ new Date()).toISOString()) {
	let r, i, a = (e) => p(e, t), o = (n) => {
		let o, s, c, l;
		try {
			l = e();
		} catch {
			let e = {
				status: "unavailable",
				error: "storage_read_failed",
				detail: "Storage access was denied."
			};
			return n && (r = void 0, i = void 0), {
				main: e,
				backup: e
			};
		}
		try {
			o = l.getItem(t.key), s = a(o);
		} catch {
			s = {
				status: "unavailable",
				error: "storage_read_failed",
				detail: "Primary save could not be read."
			};
		}
		try {
			c = a(l.getItem(t.backupKey));
		} catch {
			c = {
				status: "unavailable",
				error: "storage_read_failed",
				detail: "Backup could not be read."
			};
		}
		return n && (r = o, i = s.status === "valid" ? o ?? void 0 : void 0), {
			main: s,
			backup: c
		};
	};
	return {
		load: () => o(!0),
		inspect: () => o(!1),
		token: () => r,
		isCurrent: (n) => {
			let i = n ? n.raw : r;
			try {
				return i !== void 0 && e().getItem(t.key) === i;
			} catch {
				return !1;
			}
		},
		write: (o, s) => {
			let c = s ? s.raw : r;
			if (c === void 0) return {
				ok: !1,
				error: "storage_read_failed",
				detail: "Load the slot before writing."
			};
			let l, u;
			try {
				if (l = e(), u = l.getItem(t.key), u !== c) return {
					ok: !1,
					error: "storage_conflict",
					detail: "Another writer changed the save."
				};
			} catch {
				return {
					ok: !1,
					error: "storage_read_failed",
					detail: "Primary save could not be checked."
				};
			}
			let f, p;
			try {
				if (p = n(), !d(p)) return {
					ok: !1,
					error: "serialization_failed",
					detail: "Clock returned an invalid timestamp."
				};
				if (f = JSON.stringify({
					schemaVersion: t.schemaVersion,
					rulesVersion: t.rulesVersion,
					savedAt: p,
					state: o
				}), new TextEncoder().encode(f).byteLength > 262144) return {
					ok: !1,
					error: "save_too_large",
					detail: "Save exceeds 256 KiB."
				};
			} catch {
				return {
					ok: !1,
					error: "serialization_failed",
					detail: "Save could not be serialized."
				};
			}
			let m = !1, h = u !== null && (u === i || a(u).status === "valid") ? u : void 0;
			if (h !== void 0 && h !== f) try {
				l.setItem(t.backupKey, h);
			} catch {
				m = !0;
			}
			try {
				l.setItem(t.key, f);
			} catch {
				return {
					ok: !1,
					error: "storage_write_failed",
					detail: "Primary write failed; in-memory progress is not saved."
				};
			}
			return r = f, i = f, {
				ok: !0,
				savedAt: p,
				backupWarning: m
			};
		}
	};
}
//#endregion
//#region src/platform/writer-lease.ts
var g = "sword-led.writer";
function _(e) {
	let t = 0, n = !1, r = !1, i, a = Promise.resolve(), o = null, s = () => (t++, n = !1, i?.(), i = void 0, o = null, a);
	return {
		owns: () => n && !r,
		release: s,
		dispose: () => (r = !0, s()),
		acquire: () => {
			if (r) return Promise.resolve("disposed");
			if (!e) return Promise.resolve("unsupported");
			if (n) return Promise.resolve("writer");
			if (o) return o;
			let s = ++t, c = a.then(() => new Promise((o) => {
				if (r || s !== t) o("cancelled");
				else try {
					a = e.request(g, {
						mode: "exclusive",
						ifAvailable: !0
					}, async (e) => {
						if (r || s !== t) {
							o("cancelled");
							return;
						}
						if (e === null) {
							o("readonly");
							return;
						}
						let a = new Promise((e) => {
							i = e;
						});
						n = !0, o("writer"), await a, s === t && (n = !1, i = void 0);
					}).catch(() => {
						s === t && (n = !1, i?.(), i = void 0), o("error");
					});
				} catch {
					o("error");
				}
			}));
			return o = c, c.then(() => {
				o === c && (o = null);
			}), c;
		}
	};
}
//#endregion
//#region src/platform/browser-session.ts
function v(e = window) {
	return y(e, c, (t) => o(m(() => e.localStorage), _(t)));
}
function y(e, t, n) {
	let r;
	try {
		if (e.isSecureContext && e.navigator.locks) {
			let t = e.navigator.locks;
			r = { request: (e, n, r) => t.request(e, n, r) };
		}
	} catch {
		r = void 0;
	}
	let i = n(r), a = () => {
		i.suspend();
	}, o = (e) => {
		e.persisted && i.activate();
	}, s = (e) => {
		(e.key === t || e.key === null) && i.notifyExternalChange();
	};
	return e.addEventListener("pagehide", a), e.addEventListener("pageshow", o), e.addEventListener("storage", s), {
		...i,
		dispose: () => (e.removeEventListener("pagehide", a), e.removeEventListener("pageshow", o), e.removeEventListener("storage", s), i.dispose())
	};
}
//#endregion
export { l as a, m as c, s as d, o as f, _ as i, f as l, v as n, c as o, g as r, h as s, y as t, p as u };
