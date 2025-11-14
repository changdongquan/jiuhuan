VITE_NODE_ENV=production
VITE_APP_TITLE=CraftSys
# 生产环境下，为了保证 SSO 自动登录接口始终访问 /api/auth/auto-login，
# 这里不再添加额外的前缀，保持空值，让所有接口自己在 url 中带上 /api。
VITE_API_BASE_PATH=
VITE_BASE_PATH=/
VITE_DROP_DEBUGGER=true
VITE_DROP_CONSOLE=true
VITE_SOURCEMAP=false
VITE_OUT_DIR=dist-pro
VITE_USE_BUNDLE_ANALYZER=false
VITE_USE_ALL_ELEMENT_PLUS_STYLE=false
VITE_USE_MOCK=false
VITE_USE_CSS_SPLIT=true
# 生产环境建议关闭在线图标，避免依赖外网 CDN
VITE_USE_ONLINE_ICON=false
VITE_ICON_PREFIX=vi-
VITE_HIDE_GLOBAL_SETTING=false
