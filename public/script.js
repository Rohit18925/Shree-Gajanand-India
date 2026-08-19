document.addEventListener("DOMContentLoaded", function() {
    const navToggle = document.getElementById("navToggle");
    const navbar = document.getElementById("mainNav");
    if (navToggle && navbar) {
        navToggle.setAttribute("aria-expanded", "false");
        navToggle.addEventListener("click", function() {
            const isOpen = navbar.classList.toggle("open");
            navToggle.setAttribute("aria-expanded", String(isOpen));
        });
        navbar.querySelectorAll("a").forEach(function(link) {
            link.addEventListener("click", function() {
                navbar.classList.remove("open");
                navToggle.setAttribute("aria-expanded", "false");
            });
        });
    }
    const track = document.getElementById("projectsTrack");
    const prevBtn = document.getElementById("projPrev");
    const nextBtn = document.getElementById("projNext");
    if (track && prevBtn && nextBtn) {
        const scrollAmount = 300;
        nextBtn.addEventListener("click", () => track.scrollBy({
            left: scrollAmount,
            behavior: "smooth"
        }));
        prevBtn.addEventListener("click", () => track.scrollBy({
            left: -scrollAmount,
            behavior: "smooth"
        }));
    }
    const galleryImages = document.querySelectorAll(".gallery-item img");
    if (galleryImages.length) {
        const lightbox = document.createElement("div");
        lightbox.className = "lightbox";
        lightbox.setAttribute("role", "dialog");
        lightbox.setAttribute("aria-modal", "true");
        lightbox.setAttribute("aria-label", "Gallery image preview");
        lightbox.innerHTML = '<button class="lightbox-close" type="button" aria-label="Close image preview">&times;</button><img class="lightbox-img" alt="">';
        document.body.appendChild(lightbox);
        const lightboxImg = lightbox.querySelector(".lightbox-img");
        const closeBtn = lightbox.querySelector(".lightbox-close");
        let previousFocus = null;
        function openLightbox(img) {
            previousFocus = document.activeElement;
            lightboxImg.src = img.currentSrc || img.src;
            lightboxImg.alt = img.alt || "Gallery image";
            lightbox.classList.add("open");
            document.body.classList.add("lightbox-open");
            closeBtn.focus();
        }
        function closeLightbox() {
            lightbox.classList.remove("open");
            document.body.classList.remove("lightbox-open");
            lightboxImg.removeAttribute("src");
            if (previousFocus && previousFocus.focus) previousFocus.focus();
        }
        galleryImages.forEach(function(img) {
            img.tabIndex = 0;
            img.setAttribute("role", "button");
            img.setAttribute("aria-label", "Open " + (img.alt || "gallery image"));
            img.addEventListener("click", () => openLightbox(img));
            img.addEventListener("keydown", function(e) {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openLightbox(img);
                }
            });
        });
        closeBtn.addEventListener("click", closeLightbox);
        lightbox.addEventListener("click", e => {
            if (e.target === lightbox) closeLightbox();
        });
        document.addEventListener("keydown", e => {
            if (e.key === "Escape" && lightbox.classList.contains("open")) closeLightbox();
        });
    }
    const contactForm = document.getElementById("gajanandEnquiryForm");
    if (contactForm) {
        const submitBtn = document.getElementById("formSubmitBtn");
        const responseMsg = document.getElementById("formResponseMessage");
        const params = new URLSearchParams(window.location.search);
        if (params.get("sent") === "1") showMessage("success", "✓ Thank you! Your enquiry has been sent. We will contact you soon.");
        if (params.get("error") === "1") showMessage("error", "❌ We could not send your enquiry. Please try again or contact us by phone/WhatsApp.");
        function showMessage(type, message) {
            if (!responseMsg) return;
            responseMsg.className = "message-box " + type;
            responseMsg.textContent = message;
            responseMsg.setAttribute("role", type === "error" ? "alert" : "status");
        }
        contactForm.addEventListener("submit", async function(event) {
            event.preventDefault();
            if (!contactForm.checkValidity()) {
                contactForm.reportValidity();
                return;
            }
            const originalText = submitBtn ? submitBtn.textContent : "";
            if (submitBtn) {
                submitBtn.textContent = "Sending Enquiry...";
                submitBtn.classList.add("submit-btn-disabled");
                submitBtn.disabled = true;
            }
            if (responseMsg) responseMsg.className = "message-box";
            const payload = Object.fromEntries(new FormData(contactForm).entries());
            try {
                const response = await fetch("/submit-form", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json"
                    },
                    body: JSON.stringify(payload)
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok || data.result !== "success") {
                    throw new Error(data.error || "Unable to send enquiry.");
                }
                showMessage("success", "✓ Thank you! Your enquiry has been sent. We will contact you soon.");
                contactForm.reset();
            } catch (error) {
                showMessage("error", "❌ " + (error.message || "Something went wrong. Please try again."));
            } finally {
                if (submitBtn) {
                    submitBtn.textContent = originalText;
                    submitBtn.classList.remove("submit-btn-disabled");
                    submitBtn.disabled = false;
                }
            }
        });
    }
    const currentPath = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
    document.querySelectorAll(".navbar a").forEach(function(link) {
        const href = (link.getAttribute("href") || "").replace(/^\.\//, "").toLowerCase();
        if (href === currentPath) link.classList.add("active");
    });
});