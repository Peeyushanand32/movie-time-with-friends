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
    '1d': '₹49',
    '15d': '₹99',
    '1m': '₹199',
    '3m': '₹499',
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

  const summaryPlanTier = document.getElementById('summary-plan-tier');
  const summaryPlanDuration = document.getElementById('summary-plan-duration');
  const summaryPlanPrice = document.getElementById('summary-plan-price');

  if (tierDisplay) {
    tierDisplay.textContent = tier;
    tierDisplay.className = tier === 'premium' ? 'font-bold text-primary uppercase' : 'font-bold text-secondary uppercase';
  }
  if (durationDisplay) {
    durationDisplay.textContent = `${durationLabels[currentDuration]} - ${prices[tier][currentDuration]}`;
  }

  if (summaryPlanTier) {
    summaryPlanTier.textContent = tier;
    summaryPlanTier.className = tier === 'premium' ? 'font-bold text-primary uppercase text-xs' : 'font-bold text-secondary uppercase text-xs';
  }
  if (summaryPlanDuration) {
    summaryPlanDuration.textContent = durationLabels[currentDuration];
  }
  if (summaryPlanPrice) {
    summaryPlanPrice.textContent = prices[tier][currentDuration];
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
  const form = document.getElementById('checkout-form');
  const processingOverlay = document.getElementById('checkout-processing-overlay');
  const errorEl = document.getElementById('checkout-error');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (errorEl) errorEl.classList.add('hidden');
      if (processingOverlay) {
        processingOverlay.querySelector('p').textContent = "Creating payment order...";
        processingOverlay.classList.remove('hidden');
      }

      try {
        const res = await fetch('/api/payment/create-order', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': currentUser.id
          },
          body: JSON.stringify({
            tier: activeTier,
            duration: currentDuration
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create payment order.');

        if (processingOverlay) processingOverlay.classList.add('hidden');

        if (data.isMock) {
          // Sandbox simulation fallback flow
          const simulated = confirm(`Sandbox Checkout: Would you like to simulate a successful payment of ${prices[activeTier][currentDuration]} for the ${activeTier.toUpperCase()} (${durationLabels[currentDuration]}) plan?`);
          if (simulated) {
            if (processingOverlay) {
              processingOverlay.querySelector('p').textContent = "Simulating verification...";
              processingOverlay.classList.remove('hidden');
            }
            await verifyPaymentOnServer(data.id, `pay_mock_${Date.now()}`, `sig_mock_${Date.now()}`);
          }
        } else {
          // Live checkout flow
          const options = {
            "key": data.key,
            "amount": data.amount,
            "currency": data.currency,
            "name": "Obsidian Nebula",
            "description": `${activeTier.toUpperCase()} Plan Subscription`,
            "image": "https://api.dicebear.com/7.x/bottts/svg?seed=Obsidian",
            "order_id": data.id,
            "handler": async function (response) {
              if (processingOverlay) {
                processingOverlay.querySelector('p').textContent = "Verifying transaction signature...";
                processingOverlay.classList.remove('hidden');
              }
              await verifyPaymentOnServer(response.razorpay_order_id, response.razorpay_payment_id, response.razorpay_signature);
            },
            "prefill": {
              "name": currentUser.name || "Nebula User",
              "email": currentUser.email || ""
            },
            "theme": {
              "color": "#ffb0cd"
            }
          };
          const rzp = new Razorpay(options);
          rzp.on('payment.failed', function (response) {
            alert('Payment Failed: ' + response.error.description);
          });
          rzp.open();
        }
      } catch (err) {
        if (processingOverlay) processingOverlay.classList.add('hidden');
        if (errorEl) {
          errorEl.textContent = err.message || "Payment initiation failed.";
          errorEl.classList.remove('hidden');
        }
      }
    });
  }
}

async function verifyPaymentOnServer(orderId, paymentId, signature) {
  const processingOverlay = document.getElementById('checkout-processing-overlay');
  const errorEl = document.getElementById('checkout-error');
  try {
    const res = await fetch('/api/payment/verify-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': currentUser.id
      },
      body: JSON.stringify({
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
        tier: activeTier,
        duration: currentDuration
      })
    });

    if (processingOverlay) processingOverlay.classList.add('hidden');

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to verify transaction.');

    currentUser = data.user;
    localStorage.setItem('userProfile', JSON.stringify(currentUser));
    if (window.auth) {
      auth.user = currentUser;
      auth.updateNavbar();
    }
    closeCheckout();
    updateDashboard();
    alert('Success! Subscription successfully activated.');
    location.reload();
  } catch (err) {
    if (processingOverlay) processingOverlay.classList.add('hidden');
    if (errorEl) {
      errorEl.textContent = 'Verification Error: ' + err.message;
      errorEl.classList.remove('hidden');
    }
    alert('Verification Error: ' + err.message);
  }
}

document.addEventListener('DOMContentLoaded', initSubscription);
