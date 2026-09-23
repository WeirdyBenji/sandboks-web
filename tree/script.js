document.addEventListener('DOMContentLoaded', () => {
    const copyButtons = document.querySelectorAll('.copy-btn');

    copyButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            const code = btn.getAttribute('data-code');

            try {
                await navigator.clipboard.writeText(code);

                // Visual feedback
                const originalIcon = btn.innerHTML;
                btn.innerHTML = '<i class="fa-solid fa-check"></i>';
                btn.style.color = '#4ade80'; // Success green

                // Reset after 2 seconds
                setTimeout(() => {
                    btn.innerHTML = originalIcon;
                    btn.style.color = '';
                }, 2000);

            } catch (err) {
                console.error('Failed to copy:', err);
            }
        });
    });

    // Optional: Add 3D tilt effect to cards
    const cards = document.querySelectorAll('.link-card, .promo-card');

    cards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            card.style.setProperty('--x', `${x}px`);
            card.style.setProperty('--y', `${y}px`);
        });
    });

    // Easter Egg: Party Mode
    const profileImage = document.querySelector('.profile-image-container');
    let clickCount = 0;
    let clickTimer;

    if (profileImage) {
        profileImage.addEventListener('click', () => {
            clickCount++;

            // Reset count if no click for 1 second
            clearTimeout(clickTimer);
            clickTimer = setTimeout(() => {
                clickCount = 0;
            }, 1000);

            if (clickCount >= 5) {
                document.body.classList.toggle('party-mode');
                clickCount = 0; // Reset after triggering
            }
        });
    }

    // Theme Switcher Logic
    const themeToggleBtn = document.getElementById('theme-toggle');
    const themeIcon = themeToggleBtn.querySelector('i');

    // Check local storage or system preference
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme === 'light') {
        document.body.setAttribute('data-theme', 'light');
        themeIcon.classList.replace('fa-moon', 'fa-sun');
    } else if (savedTheme === 'dark') {
        document.body.removeAttribute('data-theme'); // Default is dark
        themeIcon.classList.replace('fa-sun', 'fa-moon');
    } else {
        // System preference logic could go here if needed
    }

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const currentTheme = document.body.getAttribute('data-theme');

            if (currentTheme === 'light') {
                document.body.removeAttribute('data-theme');
                localStorage.setItem('theme', 'dark');
                themeIcon.classList.replace('fa-sun', 'fa-moon');
            } else {
                document.body.setAttribute('data-theme', 'light');
                localStorage.setItem('theme', 'light');
                themeIcon.classList.replace('fa-moon', 'fa-sun');
            }
        });
    }

    // Prevent parent link click when clicking on the action zone (copy code area)
    const promoActions = document.querySelectorAll('.promo-action');
    promoActions.forEach(action => {
        action.addEventListener('click', (e) => {
            e.preventDefault();
            // We don't need stopPropagation if we preventDefault on the click that would trigger the anchor
        });
    });

    // Handle URL Hash Highlighting
    function handleHashChange() {
        // Remove existing highlights
        document.querySelectorAll('.promo-card').forEach(card => {
            card.classList.remove('highlight');
        });

        const hash = window.location.hash;
        if (hash) {
            try {
                // The id is on the <a> tag (e.g. #jow)
                const target = document.querySelector(hash);
                if (target && target.classList.contains('links')) {
                    const card = target.querySelector('.promo-card');
                    if (card) {
                        card.classList.add('highlight');
                        // Optional: Smooth scroll to it if not already handled by browser
                        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }
            } catch (err) {
                console.error('Invalid hash:', err);
            }
        }
    }

    // Listen for hash changes and check on load
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();
});
