// welcome.js

document.addEventListener("DOMContentLoaded", () => {
    const dashboard = document.querySelector(".dashboard-container");
    const sidebarToggle = document.querySelector(".sidebar-toggle");
    const profileDetails = document.querySelector(".profile-details");
    const profileDropdown = document.querySelector(".profile-dropdown");
    const notificationBell = document.querySelector(".notification-bell");

    /* ================================
       1. Sidebar Toggle
       ================================ */
    if (sidebarToggle) {
        sidebarToggle.addEventListener("click", () => {
            dashboard.classList.toggle("sidebar-collapsed");
        });
    }

    /* ================================
       2. Profile Dropdown Toggle
       ================================ */
    if (profileDetails && profileDropdown) {
        profileDetails.addEventListener("click", () => {
            profileDropdown.classList.toggle("show");
            profileDetails.classList.toggle("open");
        });

        // Close dropdown on outside click
        document.addEventListener("click", (e) => {
            if (!profileDetails.contains(e.target) && !profileDropdown.contains(e.target)) {
                profileDropdown.classList.remove("show");
                profileDetails.classList.remove("open");
            }
        });
    }

    /* ================================
       3. Notification Bell Jiggle
       ================================ */
    if (notificationBell) {
        notificationBell.addEventListener("click", () => {
            notificationBell.classList.add("shake");
            setTimeout(() => notificationBell.classList.remove("shake"), 600);
        });
    }

    /* ================================
       4. Dark Mode Toggle
       ================================ */
    const darkModeToggle = document.createElement("button");
    darkModeToggle.textContent = "🌙";
    darkModeToggle.setAttribute("title", "Toggle Dark Mode");
    darkModeToggle.style.background = "none";
    darkModeToggle.style.border = "none";
    darkModeToggle.style.cursor = "pointer";
    darkModeToggle.style.fontSize = "1.2rem";
    darkModeToggle.style.marginRight = "1rem";

    // Insert before profile section
    const mainHeader = document.querySelector(".main-header");
    if (mainHeader) {
        mainHeader.insertBefore(darkModeToggle, mainHeader.firstChild);
    }

    // Load saved preference
    if (localStorage.getItem("darkMode") === "enabled") {
        document.body.classList.add("dark-mode");
        darkModeToggle.textContent = "☀️";
    }

    darkModeToggle.addEventListener("click", () => {
        document.body.classList.toggle("dark-mode");
        const enabled = document.body.classList.contains("dark-mode");
        localStorage.setItem("darkMode", enabled ? "enabled" : "disabled");
        darkModeToggle.textContent = enabled ? "☀️" : "🌙";
    });

    /* ================================
       5. Sidebar Tooltips (Collapsed)
       ================================ */
    const sidebarLinks = document.querySelectorAll(".sidebar-menu a");
    sidebarLinks.forEach((link) => {
        const text = link.textContent.trim();
        if (text) {
            const tooltip = document.createElement("span");
            tooltip.classList.add("tooltip");
            tooltip.textContent = text;
            link.appendChild(tooltip);
        }
    });
});
/* ================================
   6. Logout Logic
   ================================ */
const logoutLink = document.querySelector(".logout-link");
if (logoutLink) {
    logoutLink.addEventListener("click", (event) => {
        event.preventDefault();
        console.log("Logging out...");

        localStorage.removeItem("accessToken");
        localStorage.removeItem("userName");

        window.location.href = "/";
    });
}
