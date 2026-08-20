// chemistry.js - Liquid behavior and pouring simulation

AFRAME.registerComponent('beaker-liquid', {
  schema: {
    volume: { type: 'number', default: 0.2 }, // 0.0 to 1.0
    color: { type: 'color', default: '#3b82f6' }, // Start blue (neutral indicator)
    heightMax: { type: 'number', default: 0.16 }, // Maximum physical cylinder height
    diameter: { type: 'number', default: 0.14 }
  },

  init: function () {
    // Create the liquid visual representation inside this beaker
    // The liquid is a cylinder
    this.liquidEl = document.createElement('a-cylinder');
    this.liquidEl.setAttribute('radius', this.data.diameter / 2);
    this.liquidEl.setAttribute('material', {
      color: this.data.color,
      opacity: 0.7,
      transparent: true,
      roughness: 0.1,
      metalness: 0.1,
      side: 'double'
    });
    this.el.appendChild(this.liquidEl);
    this.updateLiquidVolume();
  },

  update: function (oldData) {
    if (this.liquidEl) {
      this.liquidEl.setAttribute('material', 'color', this.data.color);
      this.updateLiquidVolume();
    }
  },

  increaseVolume: function (amount) {
    this.data.volume = Math.min(1.0, this.data.volume + amount);
    this.updateLiquidVolume();

    // Check for chemical reaction trigger
    if (this.data.volume >= 0.5 && this.data.color !== '#f43f5e') {
      this.triggerReaction();
    }
  },

  updateLiquidVolume: function () {
    if (!this.liquidEl) return;
    
    // Scale height based on volume
    const height = this.data.heightMax * this.data.volume;
    this.liquidEl.setAttribute('height', Math.max(0.001, height));
    
    // Position offset. Since standard cylinder pivot is in its center,
    // we must position it so the bottom stays resting at the beaker bottom (Y = 0.01)
    const yPos = 0.01 + height / 2;
    this.liquidEl.setAttribute('position', `0 ${yPos} 0`);
  },

  triggerReaction: function () {
    // Transition color to pink/red
    this.data.color = '#f43f5e'; // Acidic indicator color
    this.liquidEl.setAttribute('material', 'color', this.data.color);
    
    // Emit reaction event
    this.el.emit('reaction-triggered', { beaker: this.el });
  }
});


AFRAME.registerComponent('pourable', {
  init: function () {
    // Create the stream element dynamically in the scene if it doesn't exist
    let stream = document.querySelector('#pouring-stream');
    if (!stream) {
      stream = document.createElement('a-cylinder');
      stream.setAttribute('id', 'pouring-stream');
      stream.setAttribute('radius', '0.008'); // Thin stream
      stream.setAttribute('material', {
        color: '#e2e8f0', // Clear/whitish stream
        opacity: 0.6,
        transparent: true,
        emissive: '#e2e8f0',
        emissiveIntensity: 0.2
      });
      stream.setAttribute('visible', 'false');
      this.el.sceneEl.appendChild(stream);
    }
    this.streamEl = stream;
    this.isPouring = false;
  },

  tick: function (time, timeDelta) {
    const grabbable = this.el.components.grabbable;
    if (!grabbable || (!grabbable.grabbedBy && !grabbable.isDesktopGrabbed)) {
      this.stopPouring();
      return;
    }

    // 1. Detect tilt angle of bottle
    // The bottle up vector is along local Y axis
    const localY = new THREE.Vector3(0, 1, 0);
    localY.applyQuaternion(this.el.object3D.quaternion);
    
    // If localY.y is below 0.65, it is tilted past roughly 45 degrees
    const isTilted = localY.y < 0.65;

    if (!isTilted) {
      this.stopPouring();
      this.spillTimer = 0;
      return;
    }

    // 2. Check proximity to beaker
    const beakerEl = document.querySelector('.beaker');
    if (!beakerEl) {
      this.stopPouring();
      return;
    }

    // Get world positions
    const bottlePos = new THREE.Vector3();
    const beakerPos = new THREE.Vector3();
    this.el.object3D.getWorldPosition(bottlePos);
    beakerEl.object3D.getWorldPosition(beakerPos);

    // Bottle mouth offset in world coordinates (top of the bottle)
    const mouthOffset = new THREE.Vector3(0, 0.16, 0);
    mouthOffset.applyQuaternion(this.el.object3D.quaternion);
    const mouthWorldPos = new THREE.Vector3().copy(bottlePos).add(mouthOffset);

    // Beaker rim center in world coordinates
    const beakerRimWorldPos = new THREE.Vector3().copy(beakerPos).add(new THREE.Vector3(0, 0.18, 0));

    // Distance calculation
    const dx = mouthWorldPos.x - beakerRimWorldPos.x;
    const dz = mouthWorldPos.z - beakerRimWorldPos.z;
    const horizontalDistance = Math.sqrt(dx * dx + dz * dz);
    const verticalDistance = mouthWorldPos.y - beakerRimWorldPos.y;

    // Must be horizontally close (within 18cm) and above the beaker (0cm to 35cm)
    if (horizontalDistance < 0.18 && verticalDistance > -0.05 && verticalDistance < 0.35) {
      this.startPouring(mouthWorldPos, beakerRimWorldPos, beakerEl, timeDelta);
      this.spillTimer = 0;
    } else {
      this.stopPouring();
      
      // Spill detection (tilted but not near beaker)
      if (!this.spillCooldown) this.spillCooldown = 0;
      this.spillTimer = (this.spillTimer || 0) + timeDelta;
      
      if (this.spillTimer > 600 && time > this.spillCooldown) {
        this.el.sceneEl.emit('spill-warning');
        this.spillCooldown = time + 3000; // 3 second cooldown
        this.spillTimer = 0;
      }
    }
  },

  startPouring: function (mouthPos, targetPos, beakerEl, timeDelta) {
    this.isPouring = true;
    
    // Adjust visual stream endpoint slightly based on liquid level in beaker
    const liquidComp = beakerEl.components['beaker-liquid'];
    if (liquidComp) {
      // Pour rate: 12% fill volume per second
      const rate = 0.12 * (timeDelta / 1000);
      liquidComp.increaseVolume(rate);
      
      const liquidHeight = liquidComp.data.heightMax * liquidComp.data.volume;
      targetPos.y = beakerEl.object3D.position.y + liquidHeight;
    }

    // Render thin cylinder stream connecting mouth and beaker liquid
    const distance = mouthPos.distanceTo(targetPos);
    const midPoint = new THREE.Vector3().addVectors(mouthPos, targetPos).multiplyScalar(0.5);
    
    this.streamEl.object3D.position.copy(midPoint);
    
    // Direct the stream from mouth to liquid surface
    const direction = new THREE.Vector3().subVectors(targetPos, mouthPos).normalize();
    const alignQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    this.streamEl.object3D.quaternion.copy(alignQuat);
    
    this.streamEl.setAttribute('height', distance);
    this.streamEl.setAttribute('visible', 'true');

    // Trigger audio loop
    if (window.AudioSynth) {
      window.AudioSynth.startPouring();
    }
  },

  stopPouring: function () {
    if (!this.isPouring) return;
    this.isPouring = false;
    this.streamEl.setAttribute('visible', 'false');

    if (window.AudioSynth) {
      window.AudioSynth.stopPouring();
    }
  }
});
