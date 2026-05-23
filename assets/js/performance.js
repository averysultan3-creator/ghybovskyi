(function () {
    function refreshLayout() {
        if (window.reviewsSwiper && typeof window.reviewsSwiper.update === "function") {
            window.reviewsSwiper.update();
        }
        if (window.AOS && typeof window.AOS.refreshHard === "function") {
            window.AOS.refreshHard();
        }
    }

    function tuneAnimations() {
        if (!window.AOS || typeof window.AOS.init !== "function") {
            return;
        }
        window.AOS.init({
            disable: false,
            startEvent: "DOMContentLoaded",
            initClassName: "aos-init",
            animatedClassName: "aos-animate",
            useClassNames: false,
            disableMutationObserver: true,
            debounceDelay: 80,
            throttleDelay: 120,
            offset: 40,
            delay: 100,
            duration: 700,
            easing: "ease-out",
            once: true,
            mirror: false,
            anchorPlacement: "top-bottom"
        });
    }

    function syncSwiperVisibility() {
        if (!window.reviewsSwiper || !window.reviewsSwiper.autoplay) {
            return;
        }
        if (document.hidden) {
            window.reviewsSwiper.autoplay.stop();
        } else {
            window.reviewsSwiper.autoplay.start();
        }
    }

    document.addEventListener("DOMContentLoaded", function () {
        document.documentElement.classList.add("is-ready");
        tuneAnimations();
        refreshLayout();
    });

    window.addEventListener("load", refreshLayout, { once: true });
    window.addEventListener("resize", refreshLayout, { passive: true });
    document.addEventListener("visibilitychange", syncSwiperVisibility);
})();
