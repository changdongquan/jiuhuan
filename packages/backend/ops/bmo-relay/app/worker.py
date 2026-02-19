import base64
import hashlib
import mimetypes
import json
import os
import time
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode

import httpx
import redis
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.serialization import load_der_public_key

REDIS_URL = os.environ.get('REDIS_URL', 'redis://redis:6379/0')
QUEUE_KEY = os.environ.get('JOB_QUEUE_KEY', 'bmo_relay_jobs')
POLL_TIMEOUT = int(os.environ.get('WORKER_POLL_TIMEOUT', '5'))
FILES_DIR = os.environ.get('FILES_DIR', '/data/files')

BMO_BASE_URL = os.environ.get('BMO_BASE_URL', 'https://bmo.meiling.com:8023').rstrip('/')
BMO_MOULD_DETAIL_FD_VIEW_ID = os.environ.get(
    'BMO_MOULD_DETAIL_FD_VIEW_ID', '1irp0kk3gwbrwis9nw2ojg5as35h08qs3vw0'
)
BMO_MOULD_DETAIL_FD_FORM_ID = os.environ.get(
    'BMO_MOULD_DETAIL_FD_FORM_ID', '1irp0kjmvwbrwis74wkebru36jtraf1cs5w0'
)
BMO_MOULD_DETAIL_FD_XFORM_ID = os.environ.get(
    'BMO_MOULD_DETAIL_FD_XFORM_ID', '1irp0kjmvwbrwis74wkebru36jtraf1cs5w0'
)
BMO_LIST_VIEW_ID = os.environ.get('BMO_LIST_VIEW_ID', '1isqa135kwe9w4adow1ng3ksi3rrcgl912w0')
BMO_LIST_NAV_ID = os.environ.get('BMO_LIST_NAV_ID', '1j7l907fiwmnw15nidw1m9cagh1kfm6tb3w0')

BMO_LOGIN_PAGE_ENDPOINT = os.environ.get(
    'BMO_LOGIN_PAGE_ENDPOINT', '/data/sys-portal/sysPortalLoginPage/loginPage'
)
BMO_LOGIN_ENDPOINT = os.environ.get('BMO_LOGIN_ENDPOINT', '/data/sys-auth/login')
BMO_RSA_PADDING = str(os.environ.get('BMO_RSA_PADDING', 'pkcs1')).strip().lower()
BMO_AUTH_AUTO_REFRESH = str(os.environ.get('BMO_AUTH_AUTO_REFRESH', '1')).strip() != '0'
BMO_AUTH_REFRESH_COOLDOWN_SEC = int(os.environ.get('BMO_AUTH_REFRESH_COOLDOWN_SEC', '15'))
BMO_HTTP_TIMEOUT_MS = int(os.environ.get('BMO_HTTP_TIMEOUT_MS', '60000'))
AUTH_SESSION_KEY = os.environ.get('BMO_AUTH_REDIS_KEY', 'bmo:auth:session')

r = redis.Redis.from_url(REDIS_URL, decode_responses=True)
Path(FILES_DIR).mkdir(parents=True, exist_ok=True)

_AUTH = {
    'cookie': str(os.environ.get('BMO_COOKIE', '')).strip(),
    'token': str(os.environ.get('BMO_X_AUTH_TOKEN', '')).strip(),
    'last_refresh_at': 0.0,
}


def _save_auth_to_redis(source: str) -> None:
    try:
        r.hset(
            AUTH_SESSION_KEY,
            mapping={
                'cookie': str(_AUTH.get('cookie') or ''),
                'token': str(_AUTH.get('token') or ''),
                'updated_at': str(int(time.time())),
                'source': str(source or 'worker')
            }
        )
    except Exception:
        # keep worker running even if redis state write fails
        pass


def _sync_auth_from_redis() -> None:
    try:
        data = r.hgetall(AUTH_SESSION_KEY) or {}
    except Exception:
        return
    if not data:
        return
    # if session key exists, use it as source-of-truth (including empty string)
    if 'cookie' in data:
        _AUTH['cookie'] = str(data.get('cookie') or '')
    if 'token' in data:
        _AUTH['token'] = str(data.get('token') or '')


_save_auth_to_redis('boot')


def job_key(job_id: str) -> str:
    return f'bmo:job:{job_id}'


def _norm_timeout_ms(timeout_ms: int) -> float:
    v = int(timeout_ms or BMO_HTTP_TIMEOUT_MS)
    if v <= 0:
        v = 60000
    return max(1.0, v / 1000.0)


def _cookie_header_from_set_cookie(set_cookie_values: List[str]) -> str:
    pairs: List[str] = []
    for raw in set_cookie_values:
        s = str(raw or '').strip()
        if not s:
            continue
        pair = s.split(';', 1)[0].strip()
        if pair and '=' in pair:
            pairs.append(pair)
    return '; '.join(pairs)


def _encrypt_password(password: str, pubkey_base64: str) -> str:
    pub_der = base64.b64decode(str(pubkey_base64 or '').strip())
    public_key = load_der_public_key(pub_der)
    plain = str(password or '').encode('utf-8')
    if BMO_RSA_PADDING == 'oaep':
        encrypted = public_key.encrypt(
            plain,
            padding.OAEP(mgf=padding.MGF1(algorithm=hashes.SHA1()), algorithm=hashes.SHA1(), label=None),
        )
    else:
        encrypted = public_key.encrypt(plain, padding.PKCS1v15())
    return base64.b64encode(encrypted).decode('ascii')


def _refresh_auth_via_api() -> None:
    now = time.time()
    if now - float(_AUTH.get('last_refresh_at') or 0) < BMO_AUTH_REFRESH_COOLDOWN_SEC:
        return

    username = str(os.environ.get('BMO_USERNAME', '')).strip()
    password = str(os.environ.get('BMO_PASSWORD', '')).strip()
    if not username or not password:
        raise RuntimeError('BMO 自动续期失败：缺少 BMO_USERNAME/BMO_PASSWORD')

    headers = {
        'Content-Type': 'application/json;charset=UTF-8',
        'x-need-pkey': 'RSA',
        'Accept': 'application/json, text/plain, */*',
        'X-Accept-Language': 'zh-CN',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Origin': BMO_BASE_URL,
        'Referer': f'{BMO_BASE_URL}/web/',
    }
    timeout = _norm_timeout_ms(15000)

    with httpx.Client(timeout=timeout, verify=False) as c:
        pub_resp = c.post(
            f'{BMO_BASE_URL}{BMO_LOGIN_PAGE_ENDPOINT}',
            headers=headers,
            json={'fdClient': 1},
        )
        if pub_resp.status_code >= 400:
            raise RuntimeError(f'BMO 自动续期失败：获取公钥 HTTP {pub_resp.status_code}')
        pubkey = pub_resp.headers.get('x-pubkey', '')
        if not pubkey:
            raise RuntimeError('BMO 自动续期失败：未返回 x-pubkey')

        encrypted_password = _encrypt_password(password, pubkey)
        login_headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json, text/plain, */*',
            'X-Accept-Language': 'zh-CN',
            'Accept-Language': 'zh-CN,zh;q=0.9',
            'Origin': BMO_BASE_URL,
            'Referer': f'{BMO_BASE_URL}/web/',
        }
        login_resp = c.post(
            f'{BMO_BASE_URL}{BMO_LOGIN_ENDPOINT}',
            headers=login_headers,
            content=urlencode({'j_username': username, 'j_password': encrypted_password}),
        )
        login_text = login_resp.text
        login_json: Dict[str, Any] = {}
        try:
            login_json = login_resp.json()
        except Exception:
            login_json = {}
        if login_resp.status_code >= 400 or login_json.get('success') is False:
            msg = login_json.get('msg') or login_json.get('message') or login_text[:180]
            raise RuntimeError(f'BMO 自动续期失败：{msg}')

        set_cookie_values = login_resp.headers.get_list('set-cookie')
        cookie_header = _cookie_header_from_set_cookie(set_cookie_values)
        token = (
            login_resp.headers.get('x-auth-token')
            or ((login_json.get('data') or {}).get('token') if isinstance(login_json.get('data'), dict) else '')
            or login_json.get('token')
            or ''
        )
        token = str(token or '').strip()
        if token and 'X-AUTH-TOKEN=' not in cookie_header:
            cookie_header = f'{cookie_header}; X-AUTH-TOKEN={token}' if cookie_header else f'X-AUTH-TOKEN={token}'
        if not cookie_header and not token:
            raise RuntimeError('BMO 自动续期失败：登录后未获得 Cookie/Token')

    if cookie_header:
        _AUTH['cookie'] = cookie_header
    if token:
        _AUTH['token'] = token
    _AUTH['last_refresh_at'] = now
    _save_auth_to_redis('auto-refresh')


def _auth_headers(include_json_content_type: bool = True) -> Dict[str, str]:
    _sync_auth_from_redis()
    h: Dict[str, str] = {}
    if include_json_content_type:
        h['Content-Type'] = 'application/json;charset=UTF-8'
    if _AUTH.get('cookie'):
        h['Cookie'] = str(_AUTH.get('cookie'))
    if _AUTH.get('token'):
        h['X-AUTH-TOKEN'] = str(_AUTH.get('token'))
    return h


def _request_with_auto_refresh(
    method: str,
    path: str,
    *,
    timeout_ms: int,
    include_json_content_type: bool = True,
    json_payload: Optional[Dict[str, Any]] = None,
    body: Optional[str] = None,
) -> httpx.Response:
    url = f'{BMO_BASE_URL}{path}'
    timeout = _norm_timeout_ms(timeout_ms)

    with httpx.Client(timeout=timeout, verify=False) as c:
        resp = c.request(
            method.upper(),
            url,
            headers=_auth_headers(include_json_content_type=include_json_content_type),
            json=json_payload,
            content=body,
        )

        if resp.status_code in (401, 403) and BMO_AUTH_AUTO_REFRESH:
            _refresh_auth_via_api()
            resp = c.request(
                method.upper(),
                url,
                headers=_auth_headers(include_json_content_type=include_json_content_type),
                json=json_payload,
                content=body,
            )
        return resp


def _bmo_post_json(path: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    resp = _request_with_auto_refresh(
        'POST',
        path,
        timeout_ms=30000,
        include_json_content_type=True,
        json_payload=payload,
    )
    txt = resp.text
    if resp.status_code >= 400:
        raise RuntimeError(f'{path} HTTP {resp.status_code}: {txt[:220]}')
    try:
        return resp.json()
    except Exception:
        raise RuntimeError(f'{path} non-json response: {txt[:220]}')


def _bmo_post(path: str, body: str = '{}') -> httpx.Response:
    return _request_with_auto_refresh(
        'POST',
        path,
        timeout_ms=30000,
        include_json_content_type=True,
        body=body,
    )


def _bmo_get_bytes(path: str) -> httpx.Response:
    return _request_with_auto_refresh(
        'GET',
        path,
        timeout_ms=60000,
        include_json_content_type=False,
    )


def _norm_date(value):
    if value in (None, ''):
        return None
    try:
        ts = int(value)
        if ts > 1000000000000:
            return time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(ts / 1000.0))
    except Exception:
        pass
    s = str(value).strip()
    return s or None


def map_bmo_record(item: Dict[str, Any]) -> Dict[str, Any]:
    detail = item.get('mk_model_20250521q2w2c_s_3zs0l') or {}
    return {
        'bmoRecordId': item.get('fd_id'),
        'moldNumber': item.get('fd_mold_number'),
        'partNo': item.get('fd_col_zxcef7'),
        'partName': item.get('fd_col_hd3pvs'),
        'moldType': item.get('fd_col_ctjpe2'),
        'model': item.get('fd_col_00b6rj'),
        'budgetWanTaxIncl': item.get('fd_col_arsf4h'),
        'bidPriceTaxIncl': detail.get('fd_col_wifvm8'),
        'supplier': (detail.get('fd_col_zaz21j') or {}).get('fdName')
        if isinstance(detail.get('fd_col_zaz21j'), dict)
        else None,
        'projectManager': (item.get('fd_col_lj5ulc') or {}).get('fdName')
        if isinstance(item.get('fd_col_lj5ulc'), dict)
        else None,
        'moldEngineer': (item.get('fd_col_egn9jl') or {}).get('fdName')
        if isinstance(item.get('fd_col_egn9jl'), dict)
        else None,
        'designer': (item.get('fd_col_2awc2z') or {}).get('fdName')
        if isinstance(item.get('fd_col_2awc2z'), dict)
        else None,
        'projectNo': item.get('fd_col_projectno'),
        'processNo': item.get('fd_col_ds3lzr'),
        'assetNo': item.get('fd_col_b8gvrm'),
        'progressDays': item.get('fd_progress'),
        'bidTime': _norm_date(detail.get('fd_col_v01znm')),
        'projectEndTime': _norm_date(item.get('fd_col_fp487h')),
    }


def run_collect(payload: Dict[str, Any]) -> Dict[str, Any]:
    page_size = int(payload.get('pageSize') or 50)
    offset = int(payload.get('offset') or 0)

    incoming_sorts = payload.get('sorts')
    if not isinstance(incoming_sorts, dict):
        incoming_sorts = {'fd_create_time': 'desc'}

    incoming_conditions = payload.get('conditions')
    if not isinstance(incoming_conditions, dict):
        incoming_conditions = {}

    incoming_params = payload.get('params')
    if not isinstance(incoming_params, dict):
        incoming_params = {}

    req = {
        'fdListViewId': BMO_LIST_VIEW_ID,
        'fdMode': 1,
        'type': 'list',
        'navId': BMO_LIST_NAV_ID,
        'sorts': incoming_sorts,
        'conditions': incoming_conditions,
        'pageSize': page_size,
        'offset': offset,
        'params': incoming_params,
    }

    data = _bmo_post_json('/data/sys-modeling/sysModelingMain/data', req)
    body = data.get('data') or {}
    content = body.get('content') or []
    total = body.get('totalSize')
    mapped = [map_bmo_record(x or {}) for x in content]
    return {
        'count': len(mapped),
        'total': int(total or 0),
        'offset': offset,
        'pageSize': page_size,
        'traceId': data.get('traceId'),
        'fetchedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'list': mapped,
    }


def run_download_attachment(payload: Dict[str, Any]) -> Dict[str, Any]:
    fd_id = str(payload.get('fdId') or '').strip()
    attachment_id = str(payload.get('attachmentId') or '').strip()
    file_name = str(payload.get('fileName') or f'{attachment_id}.bin').strip()
    if not fd_id or not attachment_id:
        raise RuntimeError('payload 缺少 fdId/attachmentId')

    view_req = {
        'fdId': fd_id,
        'fdMode': 1,
        'fdViewId': BMO_MOULD_DETAIL_FD_VIEW_ID,
        'fdFormId': BMO_MOULD_DETAIL_FD_FORM_ID,
        'fdXFormId': BMO_MOULD_DETAIL_FD_XFORM_ID,
        'mechanisms': {'load': '*'},
    }
    view = _bmo_post_json('/data/sys-modeling/sysModelingMain/view', view_req)
    mech = (((view or {}).get('data') or {}).get('mechanisms') or {}).get('sys-auth', {}).get(
        'mechAuthToken', ''
    )
    if not mech:
        raise RuntimeError('view 成功但缺少 mechAuthToken')

    check = _bmo_post(f'/data/sys-attach/checkDownload/{attachment_id}?mechAuthToken={mech}', '{}')
    if check.status_code >= 400:
        raise RuntimeError(f'checkDownload HTTP {check.status_code}: {check.text[:220]}')

    dl = _bmo_get_bytes(f'/data/sys-attach/download/{attachment_id}?mechAuthToken={mech}')
    if dl.status_code >= 400:
        raise RuntimeError(f'download HTTP {dl.status_code}: {dl.text[:220]}')

    safe_name = ''.join(ch if ch not in '\\/:*?"<>|\r\n' else '_' for ch in file_name) or f'{attachment_id}.bin'
    file_id = f"{int(time.time() * 1000)}_{attachment_id}_{safe_name}"
    path = Path(FILES_DIR) / file_id
    path.write_bytes(dl.content)

    sha256 = hashlib.sha256(dl.content).hexdigest()
    return {
        'fileId': file_id,
        'fileName': safe_name,
        'size': path.stat().st_size,
        'sha256': sha256,
        'contentType': dl.headers.get('content-type', 'application/octet-stream'),
    }


def run_writeback(payload: Dict[str, Any]) -> Dict[str, Any]:
    path = str(payload.get('path') or '').strip()
    body = payload.get('body') or {}
    if not path:
        raise RuntimeError('writeback 缺少 path')
    data = _bmo_post_json(path, body)
    return {'path': path, 'response': data}


def run_upload_attachment(payload: Dict[str, Any]) -> Dict[str, Any]:
    upload_path = str(payload.get('path') or '').strip()
    if not upload_path:
        raise RuntimeError('upload_attachment 缺少 path')

    file_id = str(payload.get('fileId') or '').strip()
    local_file = str(payload.get('localFile') or '').strip()
    field_name = str(payload.get('fieldName') or 'file').strip() or 'file'
    file_name = str(payload.get('fileName') or '').strip()
    form_fields = payload.get('fields') if isinstance(payload.get('fields'), dict) else {}

    if file_id:
        src = Path(FILES_DIR) / Path(file_id).name
    elif local_file:
        src = Path(local_file).expanduser().resolve()
    else:
        raise RuntimeError('upload_attachment 缺少 fileId/localFile')

    if not src.exists() or not src.is_file():
        raise RuntimeError(f'upload file not found: {src}')

    if not file_name:
        file_name = src.name

    content_type = payload.get('contentType')
    if not content_type:
        content_type = mimetypes.guess_type(file_name)[0] or 'application/octet-stream'

    with src.open('rb') as fp:
        files = {field_name: (file_name, fp, content_type)}
        with httpx.Client(timeout=_norm_timeout_ms(90000), verify=False) as c:
            resp = c.post(
                f'{BMO_BASE_URL}{upload_path}',
                headers={k: v for k, v in _auth_headers(include_json_content_type=False).items() if k != 'Content-Type'},
                data={k: str(v) for k, v in form_fields.items()},
                files=files,
            )
            if resp.status_code in (401, 403) and BMO_AUTH_AUTO_REFRESH:
                _refresh_auth_via_api()
                fp.seek(0)
                resp = c.post(
                    f'{BMO_BASE_URL}{upload_path}',
                    headers={
                        k: v
                        for k, v in _auth_headers(include_json_content_type=False).items()
                        if k != 'Content-Type'
                    },
                    data={k: str(v) for k, v in form_fields.items()},
                    files=files,
                )

    txt = resp.text
    out = None
    try:
        out = resp.json()
    except Exception:
        out = txt[:600]

    if resp.status_code >= 400:
        raise RuntimeError(f'upload HTTP {resp.status_code}: {str(out)[:300]}')

    return {
        'path': upload_path,
        'statusCode': resp.status_code,
        'fileName': file_name,
        'size': src.stat().st_size,
        'response': out,
    }


def run_job(job_type: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    if job_type == 'collect':
        return run_collect(payload)
    if job_type == 'download_attachment':
        return run_download_attachment(payload)
    if job_type == 'writeback':
        return run_writeback(payload)
    if job_type == 'upload_attachment':
        return run_upload_attachment(payload)
    raise RuntimeError(f'unsupported job type: {job_type}')


while True:
    item = r.blpop(QUEUE_KEY, timeout=POLL_TIMEOUT)
    if not item:
        continue

    _, job_id = item
    data = r.hgetall(job_key(job_id))
    if not data:
        continue

    job_type = str(data.get('type') or '')
    try:
        payload = json.loads(data.get('payload') or '{}')
    except Exception:
        payload = {}

    now = int(time.time())
    r.hset(job_key(job_id), mapping={'status': 'running', 'started_at': str(now), 'error': ''})

    try:
        result = run_job(job_type, payload)
        done = int(time.time())
        r.hset(
            job_key(job_id),
            mapping={
                'status': 'success',
                'finished_at': str(done),
                'result': json.dumps(result, ensure_ascii=False),
            },
        )
    except Exception as e:
        fail = int(time.time())
        r.hset(job_key(job_id), mapping={'status': 'failed', 'finished_at': str(fail), 'error': str(e)[:600]})
