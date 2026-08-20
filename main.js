// main.js - Entrypoint, Bunsen Burner logic, and overlay interactions

AFRAME.registerComponent('bunsen-burner', {
  init: function () {
    this.burnerOn = false;
    this.flameEl = this.el.querySelector('.burner-flame');
    this.lightEl = this.el.querySelector('.burner-light');

    if (this.flameEl) this.flameEl.setAttribute('visible', false);
    if (this.lightEl) this.lightEl.setAttribute('visible', false);

    const toggle = (evt) => {
      if (evt) evt.stopPropagation();

      if (this.lastToggle && (performance.now() - this.lastToggle < 200)) return;
      this.lastToggle = performance.now();

      this.burnerOn = !this.burnerOn;
      
      if (this.flameEl) this.flameEl.setAttribute('visible', this.burnerOn);
      if (this.lightEl) this.lightEl.setAttribute('visible', this.burnerOn);

      if (window.AudioSynth) {
        window.AudioSynth.play(this.burnerOn ? 'grab' : 'release');
      }

      this.el.emit('burner-toggled', { on: this.burnerOn });
    };

    // Bind to self and child shapes
    this.el.classList.add('clickable');
    this.el.addEventListener('mousedown', toggle);
    this.el.addEventListener('click', toggle);

    const children = this.el.querySelectorAll('*');
    children.forEach(child => {
      child.classList.add('clickable');
      child.addEventListener('mousedown', toggle);
      child.addEventListener('click', toggle);
    });

    // Hover feedback
    this.el.addEventListener('mouseenter', () => {
      this.el.setAttribute('material', {
        emissive: '#00ffff',
        emissiveIntensity: 0.25
      });
    });
    this.el.addEventListener('mouseleave', () => {
      this.el.setAttribute('material', {
        emissive: '#000000',
        emissiveIntensity: 0.0
      });
    });
  }
});

// Configure 2D UI Overlay logic on DOM Load
document.addEventListener('DOMContentLoaded', () => {
  const instructionsPanel = document.querySelector('#desktop-instructions');
  const closeButton = document.querySelector('.close-btn');

  if (instructionsPanel && closeButton) {
    closeButton.addEventListener('click', (e) => {
      e.stopPropagation();
      instructionsPanel.classList.add('collapsed');
    });

    instructionsPanel.addEventListener('click', () => {
      if (instructionsPanel.classList.contains('collapsed')) {
        instructionsPanel.classList.remove('collapsed');
      }
    });
  }

  console.log("Virtual Chemistry Lab VR Prototype initialized.");
});
