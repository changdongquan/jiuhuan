import json
import os
import time
import uuid
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

r = redis.Redis.from_url(REDIS_URL, decode_responses=True)
app = FastAPI(title="bmo-relay-api")


class JobCreate(BaseModel):
    type: str
    payload: Dict[str, Any] = {}


class AuthSetBody(BaseModel):
    cookie: Optional[str] = None
    token: Optional[str] = None


class AuthLoginBody(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None


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
        msg = resp.text[:220]
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
