# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: checkout-delivery.test.js >> Checkout delivery - usuario autenticado sin direcciones previas >> confirmar pedido con nueva direccion completa el flujo
- Location: e2e/checkout-delivery.test.js:232:3

# Error details

```
Error: Channel closed
```

```
Error: page.waitForSelector: Target page, context or browser has been closed
Call log:
  - waiting for locator('h1') to be visible

```

```
Error: browserContext.close: Test ended.
Browser logs:

<launching> /home/yoiner/.cache/ms-playwright/chromium_headless_shell-1217/chrome-headless-shell-linux64/chrome-headless-shell --disable-field-trial-config --disable-background-networking --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-back-forward-cache --disable-breakpad --disable-client-side-phishing-detection --disable-component-extensions-with-background-pages --disable-component-update --no-default-browser-check --disable-default-apps --disable-dev-shm-usage --disable-extensions --disable-features=AvoidUnnecessaryBeforeUnloadCheckSync,BoundaryEventDispatchTracksNodeRemoval,DestroyProfileOnBrowserClose,DialMediaRouteProvider,GlobalMediaControls,HttpsUpgrades,LensOverlay,MediaRouter,PaintHolding,ThirdPartyStoragePartitioning,Translate,AutoDeElevate,RenderDocument,OptimizationHints --enable-features=CDPScreenshotNewSurface --allow-pre-commit-input --disable-hang-monitor --disable-ipc-flooding-protection --disable-popup-blocking --disable-prompt-on-repost --disable-renderer-backgrounding --force-color-profile=srgb --metrics-recording-only --no-first-run --password-store=basic --use-mock-keychain --no-service-autorun --export-tagged-pdf --disable-search-engine-choice-screen --unsafely-disable-devtools-self-xss-warnings --edge-skip-compat-layer-relaunch --enable-automation --disable-infobars --disable-search-engine-choice-screen --disable-sync --enable-unsafe-swiftshader --headless --hide-scrollbars --mute-audio --blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4 --no-sandbox --user-data-dir=/tmp/playwright_chromiumdev_profile-LjR7rU --remote-debugging-pipe --no-startup-window
<launched> pid=1706443
[pid=1706443][err] [0515/160750.870491:INFO:CONSOLE:827] "[vite] connecting...", source: http://localhost:5173/@vite/client (827)
[pid=1706443][err] [0515/160751.000473:INFO:CONSOLE:931] "[vite] connected.", source: http://localhost:5173/@vite/client (931)
[pid=1706443][err] [0515/160751.338575:ERROR:ui/gl/angle_platform_impl.cc:47] DisplayVkXcb.cpp:62 (initialize): xcb_connect() failed, error 1
[pid=1706443][err] ERR: DisplayVkXcb.cpp:62 (initialize): xcb_connect() failed, error 1
[pid=1706443][err] [0515/160751.339651:ERROR:ui/gl/angle_platform_impl.cc:47] Display.cpp:1097 (initialize): ANGLE Display::initialize error 0: Not initialized.
[pid=1706443][err] ERR: Display.cpp:1097 (initialize): ANGLE Display::initialize error 0: Not initialized.
[pid=1706443][err] [0515/160751.340832:ERROR:ui/gl/egl_util.cc:92] EGL Driver message (Critical) eglInitialize: Not initialized.
[pid=1706443][err] [0515/160751.340922:ERROR:ui/gl/gl_display.cc:638] eglInitialize SwANGLE failed with error EGL_NOT_INITIALIZED
[pid=1706443][err] [0515/160751.340989:ERROR:ui/gl/gl_display.cc:673] Initialization of all EGL display types failed.
[pid=1706443][err] [0515/160751.342161:ERROR:ui/ozone/common/gl_ozone_egl.cc:26] GLDisplayEGL::Initialize failed.
[pid=1706443][err] [0515/160752.236433:ERROR:ui/gl/angle_platform_impl.cc:47] DisplayVkXcb.cpp:62 (initialize): xcb_connect() failed, error 1
[pid=1706443][err] ERR: DisplayVkXcb.cpp:62 (initialize): xcb_connect() failed, error 1
[pid=1706443][err] [0515/160752.236590:ERROR:ui/gl/angle_platform_impl.cc:47] Display.cpp:1097 (initialize): ANGLE Display::initialize error 0: Not initialized.
[pid=1706443][err] ERR: Display.cpp:1097 (initialize): ANGLE Display::initialize error 0: Not initialized.
[pid=1706443][err] [0515/160752.236660:ERROR:ui/gl/egl_util.cc:92] EGL Driver message (Critical) eglInitialize: Not initialized.
[pid=1706443][err] [0515/160752.236723:ERROR:ui/gl/gl_display.cc:638] eglInitialize SwANGLE failed with error EGL_NOT_INITIALIZED
[pid=1706443][err] [0515/160752.236779:ERROR:ui/gl/gl_display.cc:673] Initialization of all EGL display types failed.
[pid=1706443][err] [0515/160752.236830:ERROR:ui/ozone/common/gl_ozone_egl.cc:26] GLDisplayEGL::Initialize failed.
[pid=1706443][err] [0515/160752.246448:ERROR:components/viz/service/main/viz_main_impl.cc:189] Exiting GPU process due to errors during initialization
[pid=1706443][err] [0515/160752.851318:INFO:CONSOLE:14338] "%cDownload the React DevTools for a better development experience: https://react.dev/link/react-devtools font-weight:bold", source: http://localhost:5173/node_modules/.vite/deps/react-dom_client.js?v=91c46a00 (14338)
[pid=1706443][err] [0515/160753.407310:ERROR:ui/gl/angle_platform_impl.cc:47] DisplayVkXcb.cpp:62 (initialize): xcb_connect() failed, error 1
[pid=1706443][err] ERR: DisplayVkXcb.cpp:62 (initialize): xcb_connect() failed, error 1
[pid=1706443][err] [0515/160753.407886:ERROR:ui/gl/angle_platform_impl.cc:47] Display.cpp:1097 (initialize): ANGLE Display::initialize error 0: Not initialized.
[pid=1706443][err] ERR: Display.cpp:1097 (initialize): ANGLE Display::initialize error 0: Not initialized.
[pid=1706443][err] [0515/160753.408253:ERROR:ui/gl/egl_util.cc:92] EGL Driver message (Critical) eglInitialize: Not initialized.
[pid=1706443][err] [0515/160753.408345:ERROR:ui/gl/gl_display.cc:638] eglInitialize SwANGLE failed with error EGL_NOT_INITIALIZED
[pid=1706443][err] [0515/160753.408507:ERROR:ui/gl/gl_display.cc:673] Initialization of all EGL display types failed.
[pid=1706443][err] [0515/160753.408664:ERROR:ui/ozone/common/gl_ozone_egl.cc:26] GLDisplayEGL::Initialize failed.
[pid=1706443][err] [0515/160754.229674:INFO:CONSOLE:0] "Access to fetch at 'http://localhost:8000/api/notifications/center/' from origin 'http://localhost:5173' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.", source: http://localhost:5173/checkout (0)
[pid=1706443][err] [0515/160754.232419:INFO:CONSOLE:33] "Uncaught (in promise) TypeError: Failed to fetch", source: http://localhost:5173/src/lib/api.js (33)
[pid=1706443][err] [0515/160754.461977:ERROR:ui/gl/angle_platform_impl.cc:47] DisplayVkXcb.cpp:62 (initialize): xcb_connect() failed, error 1
[pid=1706443][err] ERR: DisplayVkXcb.cpp:62 (initialize): xcb_connect() failed, error 1
[pid=1706443][err] [0515/160754.462089:ERROR:ui/gl/angle_platform_impl.cc:47] Display.cpp:1097 (initialize): ANGLE Display::initialize error 0: Not initialized.
[pid=1706443][err] ERR: Display.cpp:1097 (initialize): ANGLE Display::initialize error 0: Not initialized.
[pid=1706443][err] [0515/160754.462334:ERROR:ui/gl/egl_util.cc:92] EGL Driver message (Critical) eglInitialize: Not initialized.
[pid=1706443][err] [0515/160754.462399:ERROR:ui/gl/gl_display.cc:638] eglInitialize SwANGLE failed with error EGL_NOT_INITIALIZED
[pid=1706443][err] [0515/160754.462449:ERROR:ui/gl/gl_display.cc:673] Initialization of all EGL display types failed.
[pid=1706443][err] [0515/160754.462497:ERROR:ui/ozone/common/gl_ozone_egl.cc:26] GLDisplayEGL::Initialize failed.
[pid=1706443][err] [0515/160754.465075:ERROR:components/viz/service/main/viz_main_impl.cc:189] Exiting GPU process due to errors during initialization
[pid=1706443] <gracefully close start>
```