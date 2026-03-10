import json
import os
import time
import uuid
import threading
from typing import Any, Dict, Optional
from urllib.parse import urlencode

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
import httpx
import redis
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.serialization import load_der_public_key

REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379/0")
QUEUE_KEY = os.environ.get("JOB_QUEUE_KEY", "bmo_relay_jobs")
FILES_DIR = os.environ.get("FILES_DIR", "/data/files")
AUTH_SESSION_KEY = os.environ.get("BMO_AUTH_REDIS_KEY", "bmo:auth:session")
BMO_BASE_URL = os.environ.get("BMO_BASE_URL", "https://bmo.meiling.com:8023").rstrip("/")
BMO_LOGIN_PAGE_ENDPOINT = os.environ.get(
    "BMO_LOGIN_PAGE_ENDPOINT", "/data/sys-portal/sysPortalLoginPage/loginPage"
)
BMO_LOGIN_ENDPOINT = os.environ.get("BMO_LOGIN_ENDPOINT", "/data/sys-auth/login")
BMO_RSA_PADDING = str(os.environ.get("BMO_RSA_PADDING", "pkcs1")).strip().lower()
BMO_HTTP_TIMEOUT_MS = int(os.environ.get("BMO_HTTP_TIMEOUT_MS", "60000"))
SYNC_STATUS_KEY = os.environ.get("BMO_SYNC_STATUS_REDIS_KEY", "bmo:sync:status")
SYNC_LOCK_KEY = os.environ.get("BMO_SYNC_LOCK_REDIS_KEY", "bmo:sync:lock")
SYNC_TRIGGER_KEY = os.environ.get("BMO_SYNC_TRIGGER_REDIS_KEY", "bmo:sync:trigger")
CRAFTSYS_BMO_PERSIST_URL = str(os.environ.get("CRAFTSYS_BMO_PERSIST_URL", "")).strip()
CRAFTSYS_BMO_PERSIST_TOKEN = str(os.environ.get("CRAFTSYS_BMO_PERSIST_TOKEN", "")).strip()
BMO_SYNC_INTERVAL_MS = int(os.environ.get("BMO_SYNC_INTERVAL_MS", "300000"))
BMO_SYNC_STARTUP_DELAY_MS = int(os.environ.get("BMO_SYNC_STARTUP_DELAY_MS", "15000"))
BMO_SYNC_PAGE_SIZE = int(os.environ.get("BMO_SYNC_PAGE_SIZE", "200"))
BMO_SYNC_MAX_PAGES = int(os.environ.get("BMO_SYNC_MAX_PAGES", "10"))
BMO_SYNC_LOCK_TTL_SEC = int(os.environ.get("BMO_SYNC_LOCK_TTL_SEC", "600"))
BMO_SYNC_JOB_TIMEOUT_MS = int(os.environ.get("BMO_SYNC_JOB_TIMEOUT_MS", "180000"))
BMO_SYNC_ENABLED = str(os.environ.get("BMO_SYNC_ENABLED", "1")).strip().lower() not in {
    "0",
    "false",
    "no",
}

r = redis.Redis.from_url(REDIS_URL, decode_responses=True)
app = FastAPI(title="bmo-relay-api")
_scheduler_started = False
_scheduler_guard = threading.Lock()


class JobCreate(BaseModel):
    type: str
    payload: Dict[str, Any] = {}


class AuthSetBody(BaseModel):
    cookie: Optional[str] = None
    token: Optional[str] = None


class AuthLoginBody(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None


class SyncRunBody(BaseModel):
    trigger: Optional[str] = None
    waitMs: Optional[int] = None


def job_key(job_id: str) -> str:
    return f"bmo:job:{job_id}"


def json_or_text(value: str):
    s = str(value or "").strip()
    if not s:
        return None
    try:
        return json.loads(s)
    except Exception:
        return s


def normalize_job(data: Dict[str, str]) -> Dict[str, Any]:
    return {
        "id": data.get("id"),
        "type": data.get("type"),
        "status": data.get("status"),
        "payload": json_or_text(data.get("payload", "")) or {},
        "created_at": int(data.get("created_at") or 0),
        "started_at": int(data.get("started_at") or 0) or None,
        "finished_at": int(data.get("finished_at") or 0) or None,
        "error": data.get("error") or "",
        "result": json_or_text(data.get("result", "")),
    }


def _norm_timeout_ms(timeout_ms: int = BMO_HTTP_TIMEOUT_MS) -> float:
    v = int(timeout_ms or BMO_HTTP_TIMEOUT_MS)
    if v <= 0:
        v = 60000
    return max(1.0, v / 1000.0)


def _load_auth_state() -> Dict[str, str]:
    from_redis = r.hgetall(AUTH_SESSION_KEY) or {}
    if from_redis:
        return {
            "cookie": str(from_redis.get("cookie") or ""),
            "token": str(from_redis.get("token") or ""),
            "updated_at": str(from_redis.get("updated_at") or ""),
            "source": str(from_redis.get("source") or "redis"),
        }
    return {
        "cookie": str(os.environ.get("BMO_COOKIE", "")).strip(),
        "token": str(os.environ.get("BMO_X_AUTH_TOKEN", "")).strip(),
        "updated_at": "",
        "source": "env",
    }


def _save_auth_state(cookie: str, token: str, source: str) -> None:
    r.hset(
        AUTH_SESSION_KEY,
        mapping={
            "cookie": str(cookie or ""),
            "token": str(token or ""),
            "updated_at": str(int(time.time())),
            "source": str(source or "api"),
        },
    )


def _save_sync_status(**kwargs: Any) -> Dict[str, Any]:
    payload = {}
    for key, value in kwargs.items():
        if value is None:
            payload[key] = ""
        elif isinstance(value, (dict, list)):
            payload[key] = json.dumps(value, ensure_ascii=False)
        else:
            payload[key] = str(value)
    if payload:
        r.hset(SYNC_STATUS_KEY, mapping=payload)
    return _load_sync_status()


def _load_sync_status() -> Dict[str, Any]:
    raw = r.hgetall(SYNC_STATUS_KEY) or {}

    def _read_json(name: str):
        value = str(raw.get(name) or "").strip()
        if not value:
            return None
        try:
            return json.loads(value)
        except Exception:
            return value

    def _read_int(name: str):
        value = str(raw.get(name) or "").strip()
        return int(value) if value.isdigit() else None

    return {
        "enabled": BMO_SYNC_ENABLED and bool(CRAFTSYS_BMO_PERSIST_URL) and bool(CRAFTSYS_BMO_PERSIST_TOKEN),
        "persistUrl": CRAFTSYS_BMO_PERSIST_URL or None,
        "running": str(raw.get("running") or "0") == "1",
        "lastTrigger": str(raw.get("lastTrigger") or "").strip() or None,
        "lastStartedAt": str(raw.get("lastStartedAt") or "").strip() or None,
        "lastFinishedAt": str(raw.get("lastFinishedAt") or "").strip() or None,
        "lastSuccessAt": str(raw.get("lastSuccessAt") or "").strip() or None,
        "lastErrorAt": str(raw.get("lastErrorAt") or "").strip() or None,
        "lastError": str(raw.get("lastError") or "").strip() or None,
        "lastTraceId": str(raw.get("lastTraceId") or "").strip() or None,
        "lastFetched": _read_int("lastFetched"),
        "lastPersisted": _read_int("lastPersisted"),
        "lastTotal": _read_int("lastTotal"),
        "lastPersistResponse": _read_json("lastPersistResponse"),
    }


def _sync_ready() -> bool:
    return BMO_SYNC_ENABLED and bool(CRAFTSYS_BMO_PERSIST_URL) and bool(CRAFTSYS_BMO_PERSIST_TOKEN)


def _enqueue_job(job_type: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    job_id = f"job_{int(time.time() * 1000)}_{uuid.uuid4().hex[:8]}"
    now = int(time.time())
    data = {
        "id": job_id,
        "type": job_type,
        "status": "queued",
        "payload": json.dumps(payload, ensure_ascii=False),
        "created_at": str(now),
        "started_at": "",
        "finished_at": "",
        "error": "",
        "result": "",
    }
    r.hset(job_key(job_id), mapping=data)
    r.rpush(QUEUE_KEY, job_id)
    return normalize_job(data)


def _wait_job_done(job_id: str, timeout_ms: int) -> Dict[str, Any]:
    deadline = time.time() + max(3.0, _norm_timeout_ms(timeout_ms))
    while time.time() < deadline:
        data = r.hgetall(job_key(job_id))
        if data:
            normalized = normalize_job(data)
            state = str(normalized.get("status") or "").strip().lower()
            if state in {"success", "failed"}:
                return normalized
        time.sleep(1.0)
    raise RuntimeError(f"sync collect job timeout ({timeout_ms}ms)")


def _collect_all_pages(page_size: int, max_pages: int) -> Dict[str, Any]:
    offset = 0
    total = None
    trace_id = None
    fetched_at = None
    items = []

    for _ in range(max_pages):
        created = _enqueue_job("collect", {"pageSize": page_size, "offset": offset})
        job_id = str(created.get("id") or "").strip()
        if not job_id:
            raise RuntimeError("collect 创建任务失败（缺少 jobId）")
        done = _wait_job_done(job_id, BMO_SYNC_JOB_TIMEOUT_MS)
        if str(done.get("status") or "").strip().lower() != "success":
            raise RuntimeError(str(done.get("error") or "collect failed"))
        result = done.get("result") if isinstance(done.get("result"), dict) else {}
        page_list = result.get("list") if isinstance(result.get("list"), list) else []
        if result.get("traceId"):
            trace_id = str(result.get("traceId"))
        if result.get("fetchedAt"):
            fetched_at = str(result.get("fetchedAt"))
        if result.get("total") is not None:
            try:
                total = int(result.get("total"))
            except Exception:
                total = total
        items.extend(page_list)
        if not page_list or len(page_list) < page_size:
            break
        offset += page_size
        if total is not None and offset >= total:
            break

    return {
        "list": items,
        "fetched": len(items),
        "total": total if total is not None else len(items),
        "traceId": trace_id,
        "fetchedAt": fetched_at or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


def _persist_mould_list(result: Dict[str, Any], source: str) -> Dict[str, Any]:
    headers = {
        "Content-Type": "application/json",
        "X-Internal-Token": CRAFTSYS_BMO_PERSIST_TOKEN,
    }
    payload = {
        "source": source,
        "list": result.get("list") or [],
        "traceId": result.get("traceId"),
        "fetched": result.get("fetched"),
        "total": result.get("total"),
        "fetchedAt": result.get("fetchedAt"),
    }
    with httpx.Client(timeout=_norm_timeout_ms(BMO_SYNC_JOB_TIMEOUT_MS), verify=False) as c:
        resp = c.post(CRAFTSYS_BMO_PERSIST_URL, headers=headers, json=payload)
        text = resp.text
        try:
            data = resp.json()
        except Exception:
            data = None
        if resp.status_code >= 400:
            message = (
                (data or {}).get("message")
                or (data or {}).get("detail")
                or text
                or f"persist HTTP {resp.status_code}"
            )
            raise RuntimeError(str(message)[:500])
        return (data or {}).get("data") if isinstance(data, dict) else {}


def _run_sync_once(trigger: str) -> Dict[str, Any]:
    if not _sync_ready():
        raise RuntimeError("sync 未启用：缺少 CRAFTSYS_BMO_PERSIST_URL 或 CRAFTSYS_BMO_PERSIST_TOKEN")

    lock_value = uuid.uuid4().hex
    if not r.set(SYNC_LOCK_KEY, lock_value, nx=True, ex=max(60, BMO_SYNC_LOCK_TTL_SEC)):
        current = _load_sync_status()
        return {"started": False, "skipped": True, "reason": "running", "status": current}

    started_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    _save_sync_status(running="1", lastTrigger=trigger, lastStartedAt=started_at, lastError=None)
    try:
        collected = _collect_all_pages(
            max(1, BMO_SYNC_PAGE_SIZE),
            max(1, BMO_SYNC_MAX_PAGES),
        )
        persisted = _persist_mould_list(collected, trigger)
        finished_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        status = _save_sync_status(
            running="0",
            lastFinishedAt=finished_at,
            lastSuccessAt=finished_at,
            lastError=None,
            lastTraceId=collected.get("traceId"),
            lastFetched=collected.get("fetched"),
            lastPersisted=(persisted or {}).get("upserted") if isinstance(persisted, dict) else None,
            lastTotal=collected.get("total"),
            lastPersistResponse=persisted,
        )
        return {
            "started": True,
            "skipped": False,
            "fetched": collected.get("fetched"),
            "total": collected.get("total"),
            "traceId": collected.get("traceId"),
            "persisted": persisted,
            "status": status,
        }
    except Exception as e:
        finished_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        _save_sync_status(
            running="0",
            lastFinishedAt=finished_at,
            lastErrorAt=finished_at,
            lastError=str(e)[:500],
        )
        raise
    finally:
        current = str(r.get(SYNC_LOCK_KEY) or "")
        if current == lock_value:
            r.delete(SYNC_LOCK_KEY)


def _run_sync_background(trigger: str) -> None:
    try:
        _run_sync_once(trigger)
    except Exception:
        pass


def _scheduler_loop() -> None:
    delay_sec = max(1.0, BMO_SYNC_STARTUP_DELAY_MS / 1000.0)
    interval_sec = max(60.0, BMO_SYNC_INTERVAL_MS / 1000.0)
    time.sleep(delay_sec)
    while True:
        if _sync_ready():
            trigger = str(r.get(SYNC_TRIGGER_KEY) or "").strip() or "scheduler"
            if trigger != "scheduler":
                r.delete(SYNC_TRIGGER_KEY)
            try:
                _run_sync_once(trigger)
            except Exception:
                pass
        time.sleep(interval_sec)


@app.on_event("startup")
def startup_sync_scheduler():
    global _scheduler_started
    with _scheduler_guard:
        if _scheduler_started:
            return
        _scheduler_started = True
    _save_sync_status(
        running="0",
        lastTrigger=None,
        lastStartedAt=None,
        lastFinishedAt=None,
    )
    thread = threading.Thread(target=_scheduler_loop, name="bmo-sync-scheduler", daemon=True)
    thread.start()


def _mask_secret(raw: str, keep: int = 8) -> str:
    s = str(raw or "")
    if len(s) <= keep:
        return "*" * len(s)
    return f"{s[:keep]}***({len(s)})"


def _cookie_header_from_set_cookie(set_cookie_values):
    parts = []
    for raw in set_cookie_values or []:
        s = str(raw or "").strip()
        if not s:
            continue
        pair = s.split(";", 1)[0].strip()
        if "=" in pair:
            parts.append(pair)
    return "; ".join(parts)


def _encrypt_password(password: str, pubkey_base64: str) -> str:
    pub_der = __import__("base64").b64decode(str(pubkey_base64 or "").strip())
    public_key = load_der_public_key(pub_der)
    plain = str(password or "").encode("utf-8")
    if BMO_RSA_PADDING == "oaep":
        encrypted = public_key.encrypt(
            plain,
            padding.OAEP(mgf=padding.MGF1(algorithm=hashes.SHA1()), algorithm=hashes.SHA1(), label=None),
        )
    else:
        encrypted = public_key.encrypt(plain, padding.PKCS1v15())
    return __import__("base64").b64encode(encrypted).decode("ascii")


def _probe_auth(cookie: str, token: str) -> Dict[str, Any]:
    headers = {
        "Content-Type": "application/json;charset=UTF-8",
        "Accept": "application/json, text/plain, */*",
    }
    if cookie:
        headers["Cookie"] = cookie
    if token:
        headers["X-AUTH-TOKEN"] = token
    payload = {
        "fdListViewId": "1isqa135kwe9w4adow1ng3ksi3rrcgl912w0",
        "fdMode": 1,
        "type": "list",
        "navId": "1j7l907fiwmnw15nidw1m9cagh1kfm6tb3w0",
        "sorts": {"fd_create_time": "desc"},
        "conditions": {},
        "pageSize": 1,
        "offset": 0,
        "params": {},
    }
    with httpx.Client(timeout=_norm_timeout_ms(12000), verify=False) as c:
        resp = c.post(
            f"{BMO_BASE_URL}/data/sys-modeling/sysModelingMain/data",
            headers=headers,
            json=payload,
        )
    ok = resp.status_code < 400
    msg = ""
    if not ok:
        body_text = resp.text[:400]
        parsed = json_or_text(body_text)
        if isinstance(parsed, dict):
            msg = str(
                parsed.get("msg")
                or parsed.get("message")
                or parsed.get("error")
                or parsed.get("detail")
                or body_text
            )[:220]
        else:
            msg = str(parsed or body_text)[:220]
    return {"ok": ok, "status": resp.status_code, "message": msg}


def _refresh_auth_via_api(username: str, password: str) -> Dict[str, Any]:
    headers = {
        "Content-Type": "application/json;charset=UTF-8",
        "x-need-pkey": "RSA",
        "Accept": "application/json, text/plain, */*",
        "X-Accept-Language": "zh-CN",
        "Accept-Language": "zh-CN,zh;q=0.9",
        "Origin": BMO_BASE_URL,
        "Referer": f"{BMO_BASE_URL}/web/",
    }
    with httpx.Client(timeout=_norm_timeout_ms(15000), verify=False) as c:
        pub_resp = c.post(
            f"{BMO_BASE_URL}{BMO_LOGIN_PAGE_ENDPOINT}",
            headers=headers,
            json={"fdClient": 1},
        )
        if pub_resp.status_code >= 400:
            raise RuntimeError(f"获取公钥失败 HTTP {pub_resp.status_code}")
        pubkey = pub_resp.headers.get("x-pubkey", "")
        if not pubkey:
            raise RuntimeError("获取公钥失败：未返回 x-pubkey")
        enc_pwd = _encrypt_password(password, pubkey)

        login_headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json, text/plain, */*",
            "X-Accept-Language": "zh-CN",
            "Accept-Language": "zh-CN,zh;q=0.9",
            "Origin": BMO_BASE_URL,
            "Referer": f"{BMO_BASE_URL}/web/",
        }
        login_resp = c.post(
            f"{BMO_BASE_URL}{BMO_LOGIN_ENDPOINT}",
            headers=login_headers,
            content=urlencode({"j_username": username, "j_password": enc_pwd}),
        )
        login_text = login_resp.text
        login_json: Dict[str, Any] = {}
        try:
            login_json = login_resp.json()
        except Exception:
            login_json = {}
        if login_resp.status_code >= 400 or login_json.get("success") is False:
            msg = login_json.get("msg") or login_json.get("message") or login_text[:180]
            raise RuntimeError(str(msg or "登录失败"))
        cookie = _cookie_header_from_set_cookie(login_resp.headers.get_list("set-cookie"))
        token = (
            login_resp.headers.get("x-auth-token")
            or ((login_json.get("data") or {}).get("token") if isinstance(login_json.get("data"), dict) else "")
            or login_json.get("token")
            or ""
        )
        token = str(token or "").strip()
        if token and "X-AUTH-TOKEN=" not in cookie:
            cookie = f"{cookie}; X-AUTH-TOKEN={token}" if cookie else f"X-AUTH-TOKEN={token}"
        if not cookie and not token:
            raise RuntimeError("登录成功但未返回 Cookie/Token")
        return {"cookie": cookie, "token": token}


@app.get("/health")
def health():
    try:
        pong = r.ping()
    except Exception as e:
        return {"ok": False, "ready": False, "error": str(e)}
    return {"ok": True, "ready": bool(pong), "error": ""}


@app.get("/sync/status")
def sync_status():
    return {"code": 0, "success": True, "data": _load_sync_status()}


@app.post("/sync/run")
def sync_run(body: SyncRunBody):
    trigger = str(body.trigger or "manual").strip() or "manual"
    wait_ms = int(body.waitMs or 0)
    if not _sync_ready():
        raise HTTPException(status_code=400, detail="同步未启用：缺少持久化配置")

    if wait_ms > 0:
        try:
            data = _run_sync_once(trigger)
            return {"code": 0, "success": True, "data": data}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e)[:300])

    current = _load_sync_status()
    if current.get("running"):
        return {"code": 0, "success": True, "data": {"started": False, "status": current}}

    r.set(SYNC_TRIGGER_KEY, trigger, ex=max(60, int(BMO_SYNC_INTERVAL_MS / 1000) or 60))
    thread = threading.Thread(target=_run_sync_background, args=(trigger,), daemon=True)
    thread.start()
    return {
        "code": 0,
        "success": True,
        "data": {"started": True, "trigger": trigger, "status": _load_sync_status()},
    }


@app.get("/auth/status")
def auth_status(probe: int = 0):
    st = _load_auth_state()
    cookie = st.get("cookie") or ""
    token = st.get("token") or ""
    data: Dict[str, Any] = {
        "source": st.get("source") or "unknown",
        "updatedAt": int(st.get("updated_at") or 0) or None,
        "hasCookie": bool(cookie),
        "hasToken": bool(token),
        "cookiePreview": _mask_secret(cookie, 16) if cookie else "",
        "tokenPreview": _mask_secret(token, 12) if token else "",
    }
    if int(probe or 0) == 1:
        data["probe"] = _probe_auth(cookie, token)
    return {"code": 0, "success": True, "data": data}


@app.post("/auth/set")
def auth_set(body: AuthSetBody):
    cookie = str(body.cookie or "").strip()
    token = str(body.token or "").strip()
    _save_auth_state(cookie, token, "manual-set")
    return {"code": 0, "success": True, "data": {"hasCookie": bool(cookie), "hasToken": bool(token)}}


@app.post("/auth/logout")
def auth_logout():
    _save_auth_state("", "", "manual-logout")
    return {"code": 0, "success": True, "data": {"loggedOut": True}}


@app.post("/auth/login")
def auth_login(body: AuthLoginBody):
    username = str(body.username or os.environ.get("BMO_USERNAME") or "").strip()
    password = str(body.password or os.environ.get("BMO_PASSWORD") or "").strip()
    if not username or not password:
        raise HTTPException(status_code=400, detail="缺少用户名或密码")
    try:
        refreshed = _refresh_auth_via_api(username, password)
        cookie = str(refreshed.get("cookie") or "")
        token = str(refreshed.get("token") or "")
        _save_auth_state(cookie, token, "manual-login")
        probe = _probe_auth(cookie, token)
        return {
            "code": 0,
            "success": True,
            "data": {
                "hasCookie": bool(cookie),
                "hasToken": bool(token),
                "probe": probe,
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"登录失败: {str(e)[:220]}")


@app.post("/jobs")
def create_job(body: JobCreate):
    if body.type not in {"collect", "download_attachment", "writeback", "upload_attachment"}:
        raise HTTPException(status_code=400, detail="unsupported job type")

    job_id = f"job_{int(time.time() * 1000)}_{uuid.uuid4().hex[:8]}"
    now = int(time.time())
    data = {
        "id": job_id,
        "type": body.type,
        "status": "queued",
        "payload": json.dumps(body.payload, ensure_ascii=False),
        "created_at": str(now),
        "started_at": "",
        "finished_at": "",
        "error": "",
        "result": "",
    }
    r.hset(job_key(job_id), mapping=data)
    r.rpush(QUEUE_KEY, job_id)
    return {"code": 0, "success": True, "data": normalize_job(data)}


@app.get("/jobs/{job_id}")
def get_job(job_id: str):
    data = r.hgetall(job_key(job_id))
    if not data:
        raise HTTPException(status_code=404, detail="job not found")
    return {"code": 0, "success": True, "data": normalize_job(data)}


@app.post("/jobs/{job_id}/retry")
def retry_job(job_id: str):
    data = r.hgetall(job_key(job_id))
    if not data:
        raise HTTPException(status_code=404, detail="job not found")
    r.hset(job_key(job_id), mapping={"status": "queued", "error": "", "finished_at": "", "result": ""})
    r.rpush(QUEUE_KEY, job_id)
    return {"code": 0, "success": True, "data": {"id": job_id, "status": "queued"}}


@app.get("/files/{file_id}")
def download_file(file_id: str):
    clean_id = os.path.basename(file_id)
    path = os.path.join(FILES_DIR, clean_id)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="file not found")
    return FileResponse(path, filename=clean_id)
