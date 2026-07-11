let currentUser = null;
let currentDuration = '1m'; // default to 1 Month
let activeTier = null; // premium or ultimate

const prices = {
  premium: {
    '1d': '₹29',
    '15d': '₹69',
    '1m': '₹139',
    '3m': '₹339',
    '6m': '₹569',
    '12m': '₹1099'
  },
  ultimate: {
    '1d': '₹1',
    '15d': '₹1',
    '1m': '₹1',
    '3m': '₹1',
    '6m': '₹900',
    '12m': '₹1600'
  }
};

const durationLabels = {
  '1d': '1 Day',
  '15d': '15 Days',
  '1m': '1 Month',
  '3m': '3 Months',
  '6m': '6 Months',
  '12m': '12 Months'
};

const durationPeriods = {
  '1d': '/ day',
  '15d': '/ 15 days',
  '1m': '/ month',
  '3m': '/ 3 months',
  '6m': '/ 6 months',
  '12m': '/ year'
};

async function initSubscription() {
  if (window.auth) {
    if (!auth.user) {
      await auth.init();
    }
    currentUser = auth.user;
    updateDashboard();
  }

  // Setup input formatting for credit card checkout form
  setupCardInputs();
}

function updateDashboard() {
  const dashboard = document.getElementById('active-status-dashboard');
  const tierDisplay = document.getElementById('current-tier-display');
  const metaDisplay = document.getElementById('current-meta-display');
  const cancelBtn = document.getElementById('cancel-sub-btn');
  const btnFreeSelect = document.getElementById('btn-free-select');

  if (!currentUser) return;

  dashboard.classList.remove('hidden');

  if (currentUser.tier === 'free') {
    tierDisplay.textContent = 'Free Trial';
    tierDisplay.className = 'text-on-surface-variant font-extrabold uppercase';
    const remainingMins = Math.max(0, 60 - Math.floor((currentUser.accumulatedTime || 0) / 60));
    metaDisplay.textContent = `Usage: ${Math.floor((currentUser.accumulatedTime || 0) / 60)} / 60 minutes used (${remainingMins}m remaining)`;
    cancelBtn.classList.add('hidden');
    if (btnFreeSelect) {
      btnFreeSelect.textContent = 'Current Plan';
      btnFreeSelect.disabled = true;
    }
  } else {
    tierDisplay.textContent = currentUser.tier;
    tierDisplay.className = currentUser.tier === 'premium' ? 'text-primary font-extrabold uppercase' : 'text-secondary font-extrabold uppercase';

    let daysRemaining = 'Unlimited';
    if (currentUser.subscriptionExpiresAt) {
      const diffTime = new Date(currentUser.subscriptionExpiresAt) - new Date();
      daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24))) + " days remaining";
    }
    metaDisplay.textContent = `Expires on: ${new Date(currentUser.subscriptionExpiresAt).toLocaleDateString()} (${daysRemaining})`;
    cancelBtn.classList.remove('hidden');
    if (btnFreeSelect) {
      btnFreeSelect.textContent = 'Downgrade';
      btnFreeSelect.disabled = false;
      btnFreeSelect.onclick = cancelSubscription;
      btnFreeSelect.className = 'w-full py-3.5 bg-surface-variant text-on-surface-variant rounded-2xl font-bold text-label-md hover:bg-surface-bright cursor-pointer active:scale-95 transition-all';
    }
  }
}

window.setDuration = function (duration) {
  currentDuration = duration;

  // Highlight duration button
  const buttons = ['1d', '15d', '1m', '3m', '6m', '12m'];
  buttons.forEach(d => {
    const btn = document.getElementById(`dur-${d}`);
    if (btn) {
      if (d === duration) {
        btn.className = 'px-4 py-2 rounded-xl text-label-md font-bold transition-all bg-primary text-on-primary shadow-lg shadow-primary/10';
      } else {
        btn.className = 'px-4 py-2 rounded-xl text-label-md font-bold transition-all text-on-surface-variant hover:text-on-surface';
      }
    }
  });

  // Update displayed prices
  const pricePremium = document.getElementById('price-premium');
  const periodPremium = document.getElementById('period-premium');
  const priceUltimate = document.getElementById('price-ultimate');
  const periodUltimate = document.getElementById('period-ultimate');

  if (pricePremium) pricePremium.textContent = prices.premium[duration];
  if (periodPremium) periodPremium.textContent = durationPeriods[duration];

  if (priceUltimate) priceUltimate.textContent = prices.ultimate[duration];
  if (periodUltimate) periodUltimate.textContent = durationPeriods[duration];
};

window.openCheckout = function (tier) {
  if (!currentUser) {
    alert("Please log in to purchase a subscription.");
    if (window.auth) auth.showAuthModal('login');
    return;
  }

  activeTier = tier;

  const modal = document.getElementById('checkout-modal');
  const tierDisplay = document.getElementById('checkout-tier-display');
  const durationDisplay = document.getElementById('checkout-duration-display');

  if (tierDisplay) {
    tierDisplay.textContent = tier;
    tierDisplay.className = tier === 'premium' ? 'font-bold text-primary uppercase' : 'font-bold text-secondary uppercase';
  }
  if (durationDisplay) {
    durationDisplay.textContent = `${durationLabels[currentDuration]} - ${prices[tier][currentDuration]}`;
  }

  // Clear previous errors
  const errorEl = document.getElementById('checkout-error');
  if (errorEl) errorEl.classList.add('hidden');

  if (modal) modal.classList.remove('hidden');
};

window.closeCheckout = function () {
  const modal = document.getElementById('checkout-modal');
  if (modal) modal.classList.add('hidden');
};

async function cancelSubscription() {
  if (!confirm("Are you sure you want to cancel your subscription and downgrade to the Free Trial?")) return;

  try {
    const res = await fetch('/api/user/subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': currentUser.id
      },
      body: JSON.stringify({ tier: 'free' })
    });
    if (res.ok) {
      const data = await res.json();
      currentUser = data.user;
      localStorage.setItem('userProfile', JSON.stringify(currentUser));
      if (window.auth) {
        auth.user = currentUser;
        auth.updateNavbar();
      }
      updateDashboard();
      alert("Subscription cancelled successfully.");
      location.reload();
    } else {
      const err = await res.json();
      alert("Error: " + err.error);
    }
  } catch (e) {
    console.error("Cancellation failed:", e);
    alert("Connection error.");
  }
}

function setupCardInputs() {
  const cardNumber = document.getElementById('card-number');
  const cardExpiry = document.getElementById('card-expiry');
  const cardCvc = document.getElementById('card-cvc');

  if (cardNumber) {
    cardNumber.addEventListener('input', (e) => {
      // Formats: XXXX XXXX XXXX XXXX
      let value = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
      let formatted = '';
      for (let i = 0; i < value.length; i++) {
        if (i > 0 && i % 4 === 0) formatted += ' ';
        formatted += value[i];
      }
      e.target.value = formatted;
    });
  }

  if (cardExpiry) {
    cardExpiry.addEventListener('input', (e) => {
      // Formats: MM/YY
      let value = e.target.value.replace(/\//g, '').replace(/[^0-9]/gi, '');
      if (value.length > 2) {
        e.target.value = value.substring(0, 2) + '/' + value.substring(2, 4);
      } else {
        e.target.value = value;
      }
    });
  }

  if (cardCvc) {
    cardCvc.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/[^0-9]/gi, '');
    });
  }

  // Handle Form Submit
  const form = document.getElementById('checkout-form');
  const processingOverlay = document.getElementById('checkout-processing-overlay');
  const errorEl = document.getElementById('checkout-error');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (errorEl) errorEl.classList.add('hidden');
      if (processingOverlay) processingOverlay.classList.remove('hidden');

      const cardName = document.getElementById('card-name').value.trim();
      const cardNumberVal = document.getElementById('card-number').value.replace(/\s/g, '');
      const expiry = document.getElementById('card-expiry').value.trim();
      const cvc = document.getElementById('card-cvc').value.trim();

      // Artificial transaction latency for premium feel
      setTimeout(async () => {
        try {
          const res = await fetch('/api/user/subscription', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-user-id': currentUser.id
            },
            body: JSON.stringify({
              tier: activeTier,
              duration: currentDuration,
              cardName,
              cardNumber: cardNumberVal,
              expiry,
              cvc
            })
          });

          if (processingOverlay) processingOverlay.classList.add('hidden');

          if (res.ok) {
            const data = await res.json();
            currentUser = data.user;
            localStorage.setItem('userProfile', JSON.stringify(currentUser));
            if (window.auth) {
              auth.user = currentUser;
              auth.updateNavbar();
            }
            closeCheckout();
            updateDashboard();
            alert(data.message || "Subscription activated!");
            location.reload();
          } else {
            const errData = await res.json();
            if (errorEl) {
              errorEl.textContent = errData.error || "Payment processing failed. Try again.";
              errorEl.classList.remove('hidden');
            }
          }
        } catch (err) {
          if (processingOverlay) processingOverlay.classList.add('hidden');
          if (errorEl) {
            errorEl.textContent = "Server communication error. Please try again.";
            errorEl.classList.remove('hidden');
          }
        }
      }, 1500);
    });
  }
}

document.addEventListener('DOMContentLoaded', initSubscription);
