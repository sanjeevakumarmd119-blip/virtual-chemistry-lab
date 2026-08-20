// experiment.js - Audio synthesis, Objective HUD, Safety, and Student Animations

// Web Audio API Synthesizer (No external assets required)
const AudioSynth = {
  ctx: null,
  pouringInterval: null,

  init: function () {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
  },

  play: function (type) {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const now = this.ctx.currentTime;

    switch (type) {
      case 'grab': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.exponentialRampToValueAtTime(293.66, now + 0.08); // D4
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(now + 0.08);
        break;
      }
      case 'release': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(293.66, now); // D4
        osc.frequency.exponentialRampToValueAtTime(146.83, now + 0.08); // D3
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(now + 0.08);
        break;
      }
      case 'teleport': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.35);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(now + 0.35);
        break;
      }
      case 'success': {
        // Play major triad C5 -> E5 -> G5 -> C6
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.08);
          gain.gain.setValueAtTime(0, now + idx * 0.08);
          gain.gain.linearRampToValueAtTime(0.06, now + idx * 0.08 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.4);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(now + idx * 0.08);
          osc.stop(now + idx * 0.08 + 0.45);
        });
        break;
      }
      case 'warning': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(130, now);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.linearRampToValueAtTime(0.12, now + 0.2);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(now + 0.4);
        break;
      }
    }
  },

  startPouring: function () {
    this.init();
    if (!this.ctx || this.pouringInterval) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    // Dynamic water droplets sound
    this.pouringInterval = setInterval(() => {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      
      const randomFreq = 300 + Math.random() * 700;
      osc.frequency.setValueAtTime(randomFreq, now);
      osc.frequency.exponentialRampToValueAtTime(randomFreq - 200, now + 0.04);
      
      gain.gain.setValueAtTime(0.02 + Math.random() * 0.02, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(now + 0.05);
    }, 45);
  },

  stopPouring: function () {
    if (this.pouringInterval) {
      clearInterval(this.pouringInterval);
      this.pouringInterval = null;
    }
  }
};
window.AudioSynth = AudioSynth;


// Experiment Objectives & Safety panel Controller
AFRAME.registerComponent('chemistry-experiment', {
  init: function () {
    this.objectivePanel = document.querySelector('#objective-text');
    this.safetyPanel = document.querySelector('#safety-text');
    this.experimentProgress = 0;
    this.hasCompleted = false;

    // Set initial text UI
    this.updateObjectiveUI();
    this.updateSafetyUI();

    // Event listeners
    this.el.sceneEl.addEventListener('reaction-triggered', this.onReactionComplete.bind(this));
    this.el.sceneEl.addEventListener('spill-warning', this.onSpillWarning.bind(this));
    
    // Enable Web Audio on first body click/touch
    const startAudio = () => {
      AudioSynth.init();
      window.removeEventListener('click', startAudio);
      window.removeEventListener('touchstart', startAudio);
    };
    window.addEventListener('click', startAudio);
    window.addEventListener('touchstart', startAudio);
  },

  onReactionComplete: function () {
    if (this.hasCompleted) return;
    this.hasCompleted = true;
    this.experimentProgress = 100;

    this.updateObjectiveUI();
    
    // Play success chime
    AudioSynth.play('success');

    // Update safety panel to show success checkmarks
    if (this.safetyPanel) {
      this.safetyPanel.setAttribute('value', 
        'LAB SAFETY STATUS\n\n' +
        '✓ Wear safety goggles\n' +
        '✓ Handle chemicals carefully\n' +
        '✓ Do not touch chemicals directly\n' +
        '✓ Follow experiment instructions\n\n' +
        'STATUS: EXPERIMENT SUCCESS'
      );
      this.safetyPanel.setAttribute('color', '#00ffd5');
    }
  },

  onSpillWarning: function () {
    // Spill warning triggered!
    AudioSynth.play('warning');

    if (this.safetyPanel) {
      this.safetyPanel.setAttribute('value', 
        '⚠ SAFETY WARNING\n\n' +
        'Incorrect laboratory procedure!\n' +
        'Acid spilled on table.\n\n' +
        'Clean up immediately.\n' +
        'Ensure bottle is directly over beaker!'
      );
      this.safetyPanel.setAttribute('color', '#ff007f');

      // Reset safety board text back to normal after 5 seconds
      setTimeout(() => {
        if (!this.hasCompleted) {
          this.updateSafetyUI();
        }
      }, 5000);
    }
  },

  updateObjectiveUI: function () {
    if (!this.objectivePanel) return;

    if (!this.hasCompleted) {
      this.objectivePanel.setAttribute('value',
        'CHEMISTRY EXPERIMENT\n\n' +
        'Objective:\n' +
        'Carefully pour Hydrochloric Acid\n' +
        'into the beaker indicator.\n\n' +
        'Progress:\n' +
        this.experimentProgress + '%'
      );
      this.objectivePanel.setAttribute('color', '#ffffff');
    } else {
      this.objectivePanel.setAttribute('value',
        'EXPERIMENT STEP COMPLETE\n\n' +
        'Reaction detected!\n' +
        'Indicator neutralised successfully.\n\n' +
        'Progress:\n' +
        '100%'
      );
      this.objectivePanel.setAttribute('color', '#00ffd5');
    }
  },

  updateSafetyUI: function () {
    if (!this.safetyPanel) return;
    this.safetyPanel.setAttribute('value',
      'LAB SAFETY\n\n' +
      '✓ Wear safety goggles\n' +
      '✓ Handle chemicals carefully\n' +
      '✓ Do not touch chemicals directly\n' +
      '✓ Follow experiment instructions'
    );
    this.safetyPanel.setAttribute('color', '#e2e8f0');
  }
});


// Student Idle Animations using A-Frame primitives
AFRAME.registerComponent('student-idle', {
  schema: {
    speed: { type: 'number', default: 1.0 },
    bobOffset: { type: 'number', default: 0.1 }
  },

  init: function () {
    // Generate slight random variation so students don't bob in sync
    this.randomSeed = Math.random() * 100;
    this.initialY = this.el.object3D.position.y;
    
    // Find nested sub-entities for head and arms
    this.head = this.el.querySelector('.student-head');
    this.leftArm = this.el.querySelector('.student-larm');
    this.rightArm = this.el.querySelector('.student-rarm');
  },

  tick: function (time, timeDelta) {
    const elapsed = (time / 1000) * this.data.speed + this.randomSeed;
    
    // 1. Slow, subtle vertical bobbing for the entire student
    const bob = Math.sin(elapsed * 1.5) * 0.015;
    this.el.object3D.position.y = this.initialY + bob;

    // 2. Slow head rotation (looking side to side)
    if (this.head) {
      this.head.object3D.rotation.y = Math.sin(elapsed * 0.8) * 0.25; // look left and right
      this.head.object3D.rotation.x = Math.sin(elapsed * 0.4) * 0.08; // subtle head nodding
    }

    // 3. ARM swaying/movement
    if (this.leftArm) {
      this.leftArm.object3D.rotation.x = Math.sin(elapsed * 1.2) * 0.15 - 0.2; // slight sway
    }
    if (this.rightArm) {
      this.rightArm.object3D.rotation.x = Math.cos(elapsed * 1.2) * 0.15 - 0.2;
    }
  }
});
