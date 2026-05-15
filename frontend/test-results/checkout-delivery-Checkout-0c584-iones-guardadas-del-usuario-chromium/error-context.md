# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: checkout-delivery.test.js >> Checkout delivery - usuario autenticado con direcciones existentes >> muestra direcciones guardadas del usuario
- Location: e2e/checkout-delivery.test.js:290:3

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

<launching> /home/yoiner/.cache/ms-playwright/chromium_headless_shell-1217/chrome-headless-shell-linux64/chrome-headless-shell --disable-field-trial-config --disable-background-networking --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-back-forward-cache --disable-breakpad --disable-client-side-phishing-detection --disable-component-extensions-with-background-pages --disable-component-update --no-default-browser-check --disable-default-apps --disable-dev-shm-usage --disable-extensions --disable-features=AvoidUnnecessaryBeforeUnloadCheckSync,BoundaryEventDispatchTracksNodeRemoval,DestroyProfileOnBrowserClose,DialMediaRouteProvider,GlobalMediaControls,HttpsUpgrades,LensOverlay,MediaRouter,PaintHolding,ThirdPartyStoragePartitioning,Translate,AutoDeElevate,RenderDocument,OptimizationHints --enable-features=CDPScreenshotNewSurface --allow-pre-commit-input --disable-hang-monitor --disable-ipc-flooding-protection --disable-popup-blocking --disable-prompt-on-repost --disable-renderer-backgrounding --force-color-profile=srgb --metrics-recording-only --no-first-run --password-store=basic --use-mock-keychain --no-service-autorun --export-tagged-pdf --disable-search-engine-choice-screen --unsafely-disable-devtools-self-xss-warnings --edge-skip-compat-layer-relaunch --enable-automation --disable-infobars --disable-search-engine-choice-screen --disable-sync --enable-unsafe-swiftshader --headless --hide-scrollbars --mute-audio --blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4 --no-sandbox --user-data-dir=/tmp/playwright_chromiumdev_profile-WRJhk7 --remote-debugging-pipe --no-startup-window
<launched> pid=1706442
[pid=1706442][err] [0515/160750.718155:INFO:CONSOLE:827] "[vite] connecting...", source: http://localhost:5173/@vite/client (827)
[pid=1706442][err] [0515/160750.963371:INFO:CONSOLE:931] "[vite] connected.", source: http://localhost:5173/@vite/client (931)
[pid=1706442][err] [0515/160751.557229:ERROR:ui/gl/angle_platform_impl.cc:47] DisplayVkXcb.cpp:62 (initialize): xcb_connect() failed, error 1
[pid=1706442][err] ERR: DisplayVkXcb.cpp:62 (initialize): xcb_connect() failed, error 1
[pid=1706442][err] [0515/160751.557417:ERROR:ui/gl/angle_platform_impl.cc:47] Display.cpp:1097 (initialize): ANGLE Display::initialize error 0: Not initialized.
[pid=1706442][err] ERR: Display.cpp:1097 (initialize): ANGLE Display::initialize error 0: Not initialized.
[pid=1706442][err] [0515/160751.557751:ERROR:ui/gl/egl_util.cc:92] EGL Driver message (Critical) eglInitialize: Not initialized.
[pid=1706442][err] [0515/160751.557821:ERROR:ui/gl/gl_display.cc:638] eglInitialize SwANGLE failed with error EGL_NOT_INITIALIZED
[pid=1706442][err] [0515/160751.557882:ERROR:ui/gl/gl_display.cc:673] Initialization of all EGL display types failed.
[pid=1706442][err] [0515/160751.558132:ERROR:ui/ozone/common/gl_ozone_egl.cc:26] GLDisplayEGL::Initialize failed.
[pid=1706442][err] [0515/160752.451162:ERROR:ui/gl/angle_platform_impl.cc:47] DisplayVkXcb.cpp:62 (initialize): xcb_connect() failed, error 1
[pid=1706442][err] ERR: DisplayVkXcb.cpp:62 (initialize): xcb_connect() failed, error 1
[pid=1706442][err] [0515/160752.455136:ERROR:ui/gl/angle_platform_impl.cc:47] Display.cpp:1097 (initialize): ANGLE Display::initialize error 0: Not initialized.
[pid=1706442][err] ERR: Display.cpp:1097 (initialize): ANGLE Display::initialize error 0: Not initialized.
[pid=1706442][err] [0515/160752.455240:ERROR:ui/gl/egl_util.cc:92] EGL Driver message (Critical) eglInitialize: Not initialized.
[pid=1706442][err] [0515/160752.455313:ERROR:ui/gl/gl_display.cc:638] eglInitialize SwANGLE failed with error EGL_NOT_INITIALIZED
[pid=1706442][err] [0515/160752.455383:ERROR:ui/gl/gl_display.cc:673] Initialization of all EGL display types failed.
[pid=1706442][err] [0515/160752.455449:ERROR:ui/ozone/common/gl_ozone_egl.cc:26] GLDisplayEGL::Initialize failed.
[pid=1706442][err] [0515/160752.458402:ERROR:components/viz/service/main/viz_main_impl.cc:189] Exiting GPU process due to errors during initialization
[pid=1706442][err] [0515/160752.871969:INFO:CONSOLE:14338] "%cDownload the React DevTools for a better development experience: https://react.dev/link/react-devtools font-weight:bold", source: http://localhost:5173/node_modules/.vite/deps/react-dom_client.js?v=91c46a00 (14338)
[pid=1706442][err] [0515/160753.578145:ERROR:ui/gl/angle_platform_impl.cc:47] DisplayVkXcb.cpp:62 (initialize): xcb_connect() failed, error 1
[pid=1706442][err] ERR: DisplayVkXcb.cpp:62 (initialize): xcb_connect() failed, error 1
[pid=1706442][err] [0515/160753.580161:ERROR:ui/gl/angle_platform_impl.cc:47] Display.cpp:1097 (initialize): ANGLE Display::initialize error 0: Not initialized.
[pid=1706442][err] ERR: Display.cpp:1097 (initialize): ANGLE Display::initialize error 0: Not initialized.
[pid=1706442][err] [0515/160753.580287:ERROR:ui/gl/egl_util.cc:92] EGL Driver message (Critical) eglInitialize: Not initialized.
[pid=1706442][err] [0515/160753.580352:ERROR:ui/gl/gl_display.cc:638] eglInitialize SwANGLE failed with error EGL_NOT_INITIALIZED
[pid=1706442][err] [0515/160753.580417:ERROR:ui/gl/gl_display.cc:673] Initialization of all EGL display types failed.
[pid=1706442][err] [0515/160753.580475:ERROR:ui/ozone/common/gl_ozone_egl.cc:26] GLDisplayEGL::Initialize failed.
[pid=1706442][err] [0515/160754.218349:INFO:CONSOLE:0] "Access to fetch at 'http://localhost:8000/api/notifications/center/' from origin 'http://localhost:5173' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.", source: http://localhost:5173/checkout (0)
[pid=1706442][err] [0515/160754.221391:INFO:CONSOLE:33] "Uncaught (in promise) TypeError: Failed to fetch", source: http://localhost:5173/src/lib/api.js (33)
[pid=1706442][err] [0515/160754.457445:ERROR:ui/gl/angle_platform_impl.cc:47] DisplayVkXcb.cpp:62 (initialize): xcb_connect() failed, error 1
[pid=1706442][err] ERR: DisplayVkXcb.cpp:62 (initialize): xcb_connect() failed, error 1
[pid=1706442][err] [0515/160754.457878:ERROR:ui/gl/angle_platform_impl.cc:47] Display.cpp:1097 (initialize): ANGLE Display::initialize error 0: Not initialized.
[pid=1706442][err] ERR: Display.cpp:1097 (initialize): ANGLE Display::initialize error 0: Not initialized.
[pid=1706442][err] [0515/160754.458109:ERROR:ui/gl/egl_util.cc:92] EGL Driver message (Critical) eglInitialize: Not initialized.
[pid=1706442][err] [0515/160754.458287:ERROR:ui/gl/gl_display.cc:638] eglInitialize SwANGLE failed with error EGL_NOT_INITIALIZED
[pid=1706442][err] [0515/160754.458417:ERROR:ui/gl/gl_display.cc:673] Initialization of all EGL display types failed.
[pid=1706442][err] [0515/160754.458542:ERROR:ui/ozone/common/gl_ozone_egl.cc:26] GLDisplayEGL::Initialize failed.
[pid=1706442][err] [0515/160754.461533:ERROR:components/viz/service/main/viz_main_impl.cc:189] Exiting GPU process due to errors during initialization
[pid=1706442] <gracefully close start>
[pid=1706442][err] [0515/160759.804149:ERROR:content/common/zygote/zygote_communication_linux.cc:291] Failed to send GetTerminationStatus message to zygote
[pid=1706442][err] [0515/160759.804171:WARNING:content/common/zygote/zygote_communication_linux.cc:303] Socket closed prematurely.
[pid=1706442] <process did exit: exitCode=null, signal=SIGTERM>
[pid=1706442] starting temporary directories cleanup
```