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
                // Fallback or error handling could go here
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
});
