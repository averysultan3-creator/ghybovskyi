(function () {
    var TRACK_KEYS = [
        "utm_source",
        "utm_campaign",
        "utm_adset",
        "utm_ad",
        "utm_placement",
        "fbclid"
    ];

    function randomId(prefix) {
        var alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
        var bytes = new Uint8Array(10);
        if (window.crypto && window.crypto.getRandomValues) {
            window.crypto.getRandomValues(bytes);
        } else {
            for (var i = 0; i < bytes.length; i += 1) {
                bytes[i] = Math.floor(Math.random() * 255);
            }
        }

        var id = "";
        for (var j = 0; j < bytes.length; j += 1) {
            id += alphabet[bytes[j] % alphabet.length];
        }
        return prefix + id;
    }

    function getVisitorId() {
        var key = "prelend_visitor_id";
        var existing = "";
        try {
            existing = window.localStorage.getItem(key) || "";
        } catch (error) {}

        if (existing) {
            return existing;
        }

        var visitorId = randomId("v");
        try {
            window.localStorage.setItem(key, visitorId);
        } catch (error) {}
        return visitorId;
    }

    function getClickId() {
        var key = "prelend_click_id";
        var clickId = randomId("c");
        try {
            window.sessionStorage.setItem(key, clickId);
        } catch (error) {}
        return clickId;
    }

    function getParams() {
        var search = new URLSearchParams(window.location.search);
        var data = {
            visitor_id: getVisitorId(),
            page_url: window.location.href
        };

        TRACK_KEYS.forEach(function (key) {
            var value = search.get(key);
            if (value) {
                data[key] = value;
                try {
                    window.localStorage.setItem("prelend_" + key, value);
                } catch (error) {}
                return;
            }

            try {
                value = window.localStorage.getItem("prelend_" + key);
            } catch (error) {
                value = "";
            }
            if (value) {
                data[key] = value;
            }
        });

        return data;
    }

    function sendEvent(eventName, extra) {
        if (window.location.hostname.endsWith("github.io")) {
            return;
        }

        var payload = Object.assign({}, getParams(), extra || {}, {
            event: eventName,
            timestamp: new Date().toISOString(),
            user_agent: window.navigator.userAgent
        });

        var body = JSON.stringify(payload);
        if (window.navigator.sendBeacon) {
            var blob = new Blob([body], { type: "application/json" });
            if (window.navigator.sendBeacon("/track", blob)) {
                return;
            }
        }

        try {
            fetch("/track", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: body,
                keepalive: true
            }).catch(function () {});
        } catch (error) {}
    }

    function buildTelegramUrl() {
        var url = new URL("go/telegram/", window.location.href);
        var data = getParams();
        Object.keys(data).forEach(function (key) {
            url.searchParams.set(key, data[key]);
        });
        url.searchParams.set("click_id", getClickId());
        return url.href;
    }

    function wireTelegramLinks() {
        document.querySelectorAll(".js-telegram-link").forEach(function (link) {
            link.setAttribute("href", buildTelegramUrl());
        });
    }

    document.addEventListener("DOMContentLoaded", function () {
        wireTelegramLinks();
        sendEvent("lp_view");
    });
})();
