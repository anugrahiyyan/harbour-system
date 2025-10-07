/**
 * Index Display Screen Script
 * ------------------------------------
 * Handles:
 *  - Ship record submission form
 *  - Dynamic sub-type display based on cargo type
 *  - Loading spinner overlay during submission
 *  - Toast notifications for success/error
 * ------------------------------------
 * Author: anugrahiyyan (@gbtr.x)
 */

document.addEventListener('DOMContentLoaded', () => {
  const cargoTypeSelect = document.getElementById('cargoType');
  const fishGroup = document.getElementById('fishSubTypeGroup');
  const form = document.getElementById('shipForm');

  cargoTypeSelect.addEventListener('change', () => {
    fishGroup.style.display = cargoTypeSelect.value === 'Fish' ? 'block' : 'none';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const overlay = document.getElementById('loadingOverlay');

    // Show overlay spinner
    overlay.classList.remove('hidden');

    const data = {
      shipName: document.getElementById('shipName').value.trim(),
      shipType: document.getElementById('shipType').value.trim(),
      shipCode: document.getElementById('shipCode').value.trim(),
      cargoType: document.getElementById('cargoType').value.trim(),
      cargoSubType: document.getElementById('cargoSubType').value.trim(),
      cargoDetails: document.getElementById('cargoDescription').value.trim(),
      cargoAmount: parseInt(document.getElementById('cargoAmount').value || '0', 10),
      arrivalDate: new Date().toISOString().split('T')[0]
    };

    try {
      const res = await fetch('/api/ships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await res.json();

      // Simulate the spinner delay (~1.5 sec)
      await new Promise(r => setTimeout(r, 1500));
      overlay.classList.add('hidden');

      if (res.ok && result.ok) {
        form.reset();
        document.getElementById('fishSubTypeGroup').style.display = 'none';
        showToast('✅ Ship record submitted successfully!', 'success');
      } else {
        showToast('❌ Failed to submit record.', 'error');
      }
    } catch (err) {
      console.error(err);
      overlay.classList.add('hidden');
      showToast('⚠️ Server error, please try again.', 'error');
    }
  });

  // Toast helper
  function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    const color = type === 'success' ? 'bg-emerald-600' : 'bg-red-600';

    toast.className = `fade-in ${color} text-white px-4 py-2 rounded-lg shadow-lg transform transition-all duration-500`;
    toast.textContent = message;

    container.appendChild(toast);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => toast.remove(), 500);
    }, 3000);
  }
});
