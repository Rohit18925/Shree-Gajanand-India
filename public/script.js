document.addEventListener("DOMContentLoaded", function() {
    
    // ==========================================
    // 1. मोबाइल रिस्पॉन्सिव नेविगेशन मेनू (Toggle Menu)
    // ==========================================
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

    // ==========================================
    // 2. होमपेज प्रोजेक्ट्स ट्रैक स्लाइडर (यदि उपलब्ध हो)
    // ==========================================
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

    // ==========================================
    // 3. नया प्रीमियम 3-PHOTO PREVIEW GRID & CAROUSEL LIGHTBOX
    // ==========================================
    const lightbox = document.getElementById("gallery-lightbox");
    const lightboxImg = document.getElementById("lightbox-full-img");
    const closeBtn = document.querySelector(".lightbox-close");
    const lightPrevBtn = document.querySelector(".lightbox-prev");
    const lightNextBtn = document.querySelector(".lightbox-next");

    let projectImages = [];
    let currentIndex = 0;

    // ग्रिड के अंदर दिखने वाले तीनों थंबनेल्स पर क्लिक इवेंट लगाना
    document.querySelectorAll(".preview-grid-mode .photo-placeholder.main-cover").forEach((thumb) => {
        thumb.addEventListener("click", function () {
            const parentGrid = this.closest(".project-photo-grid");
            if (!parentGrid) return;
            
            // ग्रिड के अंदर की सभी दिखने वाली और छिपी हुई इमेजेस की लिस्ट बनाना
            const visibleImgs = Array.from(parentGrid.querySelectorAll(".main-cover img"));
            const hiddenImgs = Array.from(parentGrid.querySelectorAll(".hidden-photos img"));
            projectImages = [...visibleImgs, ...hiddenImgs];

            // जिस पर्टिकुलर फोटो पर क्लिक किया गया है, उसका इंडेक्स ढूंढना
            const clickedImg = this.querySelector("img");
            const targetIndex = projectImages.findIndex(img => img.src === clickedImg.src);

            openLightbox(targetIndex >= 0 ? targetIndex : 0);
        });
    });

    function openLightbox(index) {
        if (!lightbox || !lightboxImg) return;
        currentIndex = index;
        lightboxImg.src = projectImages[currentIndex].src;
        lightboxImg.alt = projectImages[currentIndex].alt || "Project Image";
        lightbox.classList.add("open");
        document.body.classList.add("lightbox-open");
    }

    function closeLightbox() {
        if (!lightbox) return;
        lightbox.classList.remove("open");
        document.body.classList.remove("lightbox-open");
    }

    // नेक्स्ट फोटो लॉजिक
    if (lightNextBtn) {
        lightNextBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (projectImages.length === 0) return;
            currentIndex = (currentIndex + 1) % projectImages.length;
            lightboxImg.src = projectImages[currentIndex].src;
        });
    }

    // प्रीवियस फोटो लॉजिक
    if (lightPrevBtn) {
        lightPrevBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (projectImages.length === 0) return;
            currentIndex = (currentIndex - 1 + projectImages.length) % projectImages.length;
            lightboxImg.src = projectImages[currentIndex].src;
        });
    }

    if (closeBtn) closeBtn.addEventListener("click", closeLightbox);
    
    if (lightbox) {
        lightbox.addEventListener("click", (e) => {
            if (e.target === lightbox || e.target.classList.contains("lightbox-close")) closeLightbox();
        });
    }

    // कीबोर्ड एरो कंट्रोल्स
    document.addEventListener("keydown", (e) => {
        if (!lightbox || !lightbox.classList.contains("open")) return;
        if (e.key === "Escape") closeLightbox();
        if (e.key === "ArrowRight" && lightNextBtn) lightNextBtn.click();
        if (e.key === "ArrowLeft" && lightPrevBtn) lightPrevBtn.click();
    });

    // ==========================================
    // 4. संपर्क फ़ॉर्म हैंडलिंग (Contact Form)
    // ==========================================
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

    // ==========================================
    // 5. एक्टिव नेविगेशन लिंक हाइलाइटर
    // ==========================================
    const currentPath = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
    document.querySelectorAll(".navbar a").forEach(function(link) {
        const href = (link.getAttribute("href") || "").replace(/^\.\//, "").toLowerCase();
        if (href === currentPath) link.classList.add("active");
    });
});
