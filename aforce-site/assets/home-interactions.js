(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const can = document.querySelector('.can-turn');
  if (can) {
    let angle = 0, origin = 0, startAngle = 0, active = null;
    const turn = value => {
      angle = Math.max(-30, Math.min(30, value));
      can.classList.add('is-turning');
      can.style.setProperty('--can-turn', `${angle}deg`);
      can.setAttribute('aria-valuenow', String(Math.round(angle)));
      can.setAttribute('aria-valuetext', angle === 0 ? 'Facing forward' : `${Math.round(Math.abs(angle))} degrees ${angle < 0 ? 'left' : 'right'}`);
    };
    can.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0) return;
      active = event.pointerId; origin = event.clientX; startAngle = angle;
      can.setPointerCapture(active); turn(angle);
    });
    can.addEventListener('pointermove', event => {
      if (event.pointerId === active) turn(startAngle + (event.clientX - origin) * .3);
    });
    const end = () => { active = null; };
    can.addEventListener('pointerup', end);
    can.addEventListener('pointercancel', end);
    can.addEventListener('lostpointercapture', end);
    can.addEventListener('keydown', event => {
      const values = {ArrowLeft:angle - 5, ArrowDown:angle - 5, ArrowRight:angle + 5, ArrowUp:angle + 5, Home:-30, End:30, Escape:0};
      if (!(event.key in values)) return;
      event.preventDefault(); turn(values[event.key]);
    });
  }
  const phones = document.querySelector('.os-phones');
  if (phones) {
    document.querySelectorAll('[data-os-screen]').forEach(button => {
      button.addEventListener('click', () => {
        const screen = button.dataset.osScreen;
        phones.classList.toggle('show-protocol', screen === 'protocol');
        document.querySelectorAll('[data-os-screen]').forEach(control => control.setAttribute('aria-pressed', String(control.dataset.osScreen === screen)));
      });
    });
    phones.addEventListener('pointermove', event => {
      if (reduce.matches || event.pointerType !== 'mouse') return;
      const rect = phones.getBoundingClientRect();
      phones.style.setProperty('--os-x', `${(0.5 - (event.clientY - rect.top) / rect.height) * 6}deg`);
      phones.style.setProperty('--os-y', `${((event.clientX - rect.left) / rect.width - .5) * 8}deg`);
    });
    const reset = () => { phones.style.setProperty('--os-x','0deg'); phones.style.setProperty('--os-y','0deg'); };
    phones.addEventListener('pointerleave', reset);
    reduce.addEventListener('change', reset);
  }
})();
