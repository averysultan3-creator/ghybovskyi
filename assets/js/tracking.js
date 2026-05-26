(function () {
    var TRACK_KEYS = [
        "utm_source",
        "utm_campaign",
        "utm_adset",
        "utm_ad",
        "utm_placement",
        "fbclid",
        "country",
        "funnel"
    ];
    var SOURCE_KEYS = ["src", "source", "funnel", "utm_campaign", "utm_source"];
    var CLICK_DELAY_MS = 220;
    var BOT_USERNAME = (
        (window.PRELEND_RUNTIME_CONFIG && window.PRELEND_RUNTIME_CONFIG.botUsername) ||
        window.PRELEND_BOT_USERNAME ||
        "stas_hrybovskyiP2Pbot"
    ).replace(/^@/, "");
    var navigating = false;

    function randomId(prefix) {
        var alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
        var bytes = new Uint8Array(10);
        var id = "";
        var i = 0;

        if (window.crypto && window.crypto.getRandomValues) {
            window.crypto.getRandomValues(bytes);
        } else {
            for (i = 0; i < bytes.length; i += 1) {
                bytes[i] = Math.floor(Math.random() * 255);
            }
        }

        for (i = 0; i < bytes.length; i += 1) {
            id += alphabet[bytes[i] % alphabet.length];
        }
        return prefix + id;
    }

    function sanitizeSource(value) {
        return (value || "")
            .toLowerCase()
            .replace(/[а-яёіїєґ]/gi, function (char) {
                var map = {
                    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e",
                    "ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m",
                    "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
                    "ф": "f", "х": "h", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "sch",
                    "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya",
                    "і": "i", "ї": "yi", "є": "e", "ґ": "g"
                };
                return map[char.toLowerCase()] || "";
            })
            .replace(/[\s/|]+/g, "_")
            .replace(/[^a-z0-9_-]/g, "")
            .replace(/[-_]{2,}/g, "_")
            .replace(/^[-_]+|[-_]+$/g, "")
            .slice(0, 40) || "unknown";
    }

    function sanitizeClickId(value) {
        return (value || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
    }

    function getVisitorId() {
        var key = "prelend_visitor_id";
        try {
            var existing = window.localStorage.getItem(key) || "";
            if (existing) {
                return existing;
            }
        } catch (error) {}

        var visitorId = randomId("v");
        try {
            window.localStorage.setItem(key, visitorId);
        } catch (error) {}
        return visitorId;
    }

    function getSource(search) {
        var source = "";
        SOURCE_KEYS.some(function (key) {
            source = search.get(key) || "";
            return Boolean(source);
        });
        return sanitizeSource(source);
    }

    function getClickId(source) {
        var search = new URLSearchParams(window.location.search);
        var fromQuery = sanitizeClickId(search.get("click_id"));
        if (fromQuery) {
            return fromQuery;
        }

        var key = "prelend_click_id_" + source;
        try {
            var existing = window.sessionStorage.getItem(key) || "";
            if (existing) {
                return existing;
            }
        } catch (error) {}

        var clickId = "pl_" + source + "__" + randomId("");
        try {
            window.sessionStorage.setItem(key, clickId);
        } catch (error) {}
        return clickId;
    }

    function getTrackEndpoint() {
        var search = new URLSearchParams(window.location.search);
        var fromQuery = search.get("track");
        if (fromQuery) {
            return fromQuery;
        }
        if (window.PRELEND_TRACK_ENDPOINT) {
            return window.PRELEND_TRACK_ENDPOINT;
        }
        if (window.PRELEND_RUNTIME_CONFIG && window.PRELEND_RUNTIME_CONFIG.trackEndpoint) {
            return window.PRELEND_RUNTIME_CONFIG.trackEndpoint;
        }
        var meta = document.querySelector('meta[name="prelend-track-endpoint"]');
        if (meta && meta.content) {
            return meta.content;
        }
        if (window.location.hostname.endsWith("github.io")) {
            return "";
        }
        return "/track";
    }

    function getParams() {
        var search = new URLSearchParams(window.location.search);
        var source = getSource(search);
        var data = {
            visitor_id: getVisitorId(),
            source: source,
            src: source,
            click_id: getClickId(source),
            page_url: window.location.href
        };

        TRACK_KEYS.forEach(function (key) {
            var value = search.get(key);
            if (value) {
                data[key] = value;
            }
        });
        if (search.get("track")) {
            data.track = search.get("track");
        }
        return data;
    }

    function sendEvent(eventName, extra) {
        var endpoint = getTrackEndpoint();
        var payload = Object.assign({}, getParams(), extra || {}, {
            event: eventName,
            timestamp: new Date().toISOString(),
            user_agent: window.navigator.userAgent
        });

        if (!endpoint) {
            console.warn("[prelend] tracking endpoint is not configured, event skipped:", eventName);
            return Promise.resolve(false);
        }

        var body = JSON.stringify(payload);
        if (window.navigator.sendBeacon) {
            try {
                var blob = new Blob([body], { type: "application/json" });
                if (window.navigator.sendBeacon(endpoint, blob)) {
                    return Promise.resolve(true);
                }
            } catch (error) {}
        }

        try {
            return fetch(endpoint, {
                method: "POST",
                mode: "cors",
                headers: { "Content-Type": "application/json" },
                body: body,
                keepalive: true
            }).then(function () {
                return true;
            }).catch(function (error) {
                console.warn("[prelend] tracking request failed:", error);
                return false;
            });
        } catch (error) {
            console.warn("[prelend] tracking fetch failed:", error);
            return Promise.resolve(false);
        }
    }

    function buildTelegramUrl() {
        var url = new URL("https://t.me/" + BOT_USERNAME);
        var data = getParams();
        url.searchParams.set("start", data.click_id);
        return url.href;
    }

    function shouldTrackClickClientSide() {
        var endpoint = getTrackEndpoint();
        return Boolean(endpoint);
    }

    function wireTelegramLinks() {
        document.querySelectorAll(".js-telegram-link").forEach(function (link) {
            link.setAttribute("href", buildTelegramUrl());
            link.addEventListener("pointerdown", function () {
                link.setAttribute("href", buildTelegramUrl());
            }, { passive: true });
            link.addEventListener("click", function (event) {
                if (navigating) {
                    return;
                }
                if (!shouldTrackClickClientSide()) {
                    link.setAttribute("href", buildTelegramUrl());
                    return;
                }
                navigating = true;
                event.preventDefault();
                var target = buildTelegramUrl();
                sendEvent("tg_click").finally(function () {
                    window.setTimeout(function () {
                        window.location.href = target;
                    }, CLICK_DELAY_MS);
                });
            });
        });
    }

    function optimizeMedia() {
        document.querySelectorAll("img").forEach(function (img, index) {
            if (index > 2) {
                img.loading = "lazy";
            }
            img.decoding = "async";
        });
    }

    function tuneAnimations() {
        if (window.AOS) {
            window.AOS.init({
                once: true,
                duration: 500,
                easing: "ease-out",
                offset: 24,
                disable: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            });
        }
        window.setTimeout(function () {
            document.querySelectorAll("[data-aos]").forEach(function (node) {
                var styles = window.getComputedStyle(node);
                if (styles.opacity === "0") {
                    node.style.opacity = "1";
                    node.style.transform = "none";
                }
            });
        }, 1200);
        document.querySelectorAll(".swiper").forEach(function (node) {
            if (!node.swiper) {
                return;
            }
            node.swiper.params.speed = 450;
            node.swiper.update();
            document.addEventListener("visibilitychange", function () {
                if (!node.swiper.autoplay) {
                    return;
                }
                if (document.hidden) {
                    node.swiper.autoplay.stop();
                } else {
                    node.swiper.autoplay.start();
                }
            });
        });
    }

    document.addEventListener("DOMContentLoaded", function () {
        optimizeMedia();
        wireTelegramLinks();
        tuneAnimations();
        sendEvent("lp_view");
    });
})();
