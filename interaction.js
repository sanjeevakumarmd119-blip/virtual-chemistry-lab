// interaction.js - Custom A-Frame components for VR & Desktop Interactions

AFRAME.registerComponent('grabbable', {
  schema: {
    desktopOffset: { type: 'vec3', default: { x: 0.15, y: -0.2, z: -0.45 } }
  },

  init: function () {
    this.grabbedBy = null;
    this.isDesktopGrabbed = false;
    this.lastGrabTime = 0;

    // Attach listeners to self and all child shapes
    this.onGrab = this.onGrab.bind(this);
    this.bindClickEvents();
    
    // Re-bind if children are attached dynamically
    this.el.addEventListener('child-attached', () => this.bindClickEvents());

    // Hover feedback listeners
    this.el.addEventListener('mouseenter', this.onMouseEnter.bind(this));
    this.el.addEventListener('mouseleave', this.onMouseLeave.bind(this));
    
    // Desktop rotation controls
    this.desktopTiltAngle = 0;
    this.onKeyDown = this.onKeyDown.bind(this);
    window.addEventListener('keydown', this.onKeyDown);
  },

  bindClickEvents: function () {
    this.el.classList.add('clickable');
    this.el.removeEventListener('mousedown', this.onGrab);
    this.el.removeEventListener('click', this.onGrab);
    this.el.addEventListener('mousedown', this.onGrab);
    this.el.addEventListener('click', this.onGrab);

    const children = this.el.querySelectorAll('*');
    children.forEach(child => {
      child.classList.add('clickable');
      child.removeEventListener('mousedown', this.onGrab);
      child.removeEventListener('click', this.onGrab);
      child.addEventListener('mousedown', this.onGrab);
      child.addEventListener('click', this.onGrab);
    });
  },

  remove: function () {
    window.removeEventListener('keydown', this.onKeyDown);
  },

  onMouseEnter: function (evt) {
    this.setEmissive(this.el, '#00ffd5', 0.35);
  },

  onMouseLeave: function (evt) {
    this.setEmissive(this.el, '#000000', 0.0);
  },

  setEmissive: function (entity, color, intensity) {
    if (entity.getAttribute('material')) {
      entity.setAttribute('material', 'emissive', color);
      entity.setAttribute('material', 'emissiveIntensity', intensity);
    }
    const children = entity.querySelectorAll('*');
    children.forEach(child => {
      if (child.getAttribute('material')) {
        child.setAttribute('material', 'emissive', color);
        child.setAttribute('material', 'emissiveIntensity', intensity);
      }
    });
  },

  onGrab: function (evt) {
    if (evt) evt.stopPropagation();

    // Debounce fast double clicks
    const now = performance.now();
    if (now - this.lastGrabTime < 200) return;
    this.lastGrabTime = now;

    // Resolve cursor/controller element
    const cursorEl = (evt && evt.detail && evt.detail.cursorEl) || 
                     document.querySelector('#head') || 
                     document.querySelector('[camera]') || 
                     document.querySelector('[cursor]');

    const isVRController = cursorEl && cursorEl.hasAttribute && cursorEl.hasAttribute('laser-controls');

    if (isVRController) {
      if (this.grabbedBy) {
        this.release();
      } else {
        this.grabbedBy = cursorEl;
        this.grabbedBy.addEventListener('mouseup', this.onRelease.bind(this));
        this.el.emit('grabbed', { hand: cursorEl.getAttribute('laser-controls').hand });
        if (window.AudioSynth) window.AudioSynth.play('grab');
      }
    } else {
      // Desktop toggle grab logic
      if (this.isDesktopGrabbed) {
        this.release();
      } else {
        // Release any other desktop-held object
        const allGrabbables = document.querySelectorAll('[grabbable]');
        allGrabbables.forEach(el => {
          const comp = el.components.grabbable;
          if (comp && comp.isDesktopGrabbed) comp.release();
        });

        this.grabbedBy = cursorEl;
        this.isDesktopGrabbed = true;
        this.desktopTiltAngle = 0;
        this.el.emit('grabbed', { hand: 'desktop' });
        if (window.AudioSynth) window.AudioSynth.play('grab');
      }
    }
  },

  onRelease: function (evt) {
    if (this.grabbedBy) {
      this.release();
    }
  },

  release: function () {
    if (!this.grabbedBy && !this.isDesktopGrabbed) return;

    if (window.AudioSynth) {
      window.AudioSynth.play('release');
    }

    if (this.grabbedBy && !this.isDesktopGrabbed) {
      this.grabbedBy.removeEventListener('mouseup', this.onRelease);
    }

    this.grabbedBy = null;
    this.isDesktopGrabbed = false;
    this.desktopTiltAngle = 0;

    // Snap to benchtop height
    const pos = this.el.object3D.position;
    if (pos.y < 0.88) {
      pos.y = 0.88;
    }

    this.el.object3D.rotation.set(0, this.el.object3D.rotation.y, 0);
    this.el.emit('released');
  },

  onKeyDown: function (evt) {
    if (!this.isDesktopGrabbed) return;

    if (evt.key === 'r' || evt.key === 'R') {
      this.desktopTiltAngle = (this.desktopTiltAngle === 0) ? -75 : 0;
    }
  },

  tick: function () {
    if (!this.grabbedBy && !this.isDesktopGrabbed) return;

    const myObj = this.el.object3D;

    if (this.isDesktopGrabbed) {
      const camera = document.querySelector('[camera]');
      if (!camera) return;

      const cameraObj = camera.object3D;
      
      const offset = new THREE.Vector3(
        this.data.desktopOffset.x,
        this.data.desktopOffset.y,
        this.data.desktopOffset.z
      );
      
      offset.applyQuaternion(cameraObj.quaternion);
      
      const worldPos = new THREE.Vector3();
      cameraObj.getWorldPosition(worldPos);
      myObj.position.copy(worldPos).add(offset);
      
      myObj.rotation.copy(cameraObj.rotation);
      
      if (this.desktopTiltAngle !== 0) {
        myObj.rotateZ(THREE.MathUtils.degToRad(this.desktopTiltAngle));
      }
    } else {
      const controllerObj = this.grabbedBy.object3D;
      const offset = new THREE.Vector3(0, -0.02, -0.08);
      offset.applyQuaternion(controllerObj.quaternion);
      
      myObj.position.copy(controllerObj.position).add(offset);
      myObj.rotation.copy(controllerObj.rotation);
      myObj.rotateX(THREE.MathUtils.degToRad(15));
    }
  }
});

// custom teleport-node component for movement hotspots
AFRAME.registerComponent('teleport-node', {
  init: function () {
    const triggerTeleport = (evt) => {
      if (evt) evt.stopPropagation();
      const cameraRig = document.querySelector('#cameraRig');
      if (cameraRig) {
        const myPos = this.el.object3D.position;
        const rigPos = cameraRig.getAttribute('position');
        cameraRig.setAttribute('position', `${myPos.x} ${rigPos.y} ${myPos.z}`);
        
        if (window.AudioSynth) {
          window.AudioSynth.play('teleport');
        }
      }
    };

    this.bindEvents(triggerTeleport);
  },

  bindEvents: function(handler) {
    this.el.classList.add('clickable');
    this.el.addEventListener('mousedown', handler);
    this.el.addEventListener('click', handler);

    const children = this.el.querySelectorAll('*');
    children.forEach(child => {
      child.classList.add('clickable');
      child.addEventListener('mousedown', handler);
      child.addEventListener('click', handler);
    });

    this.el.addEventListener('mouseenter', () => {
      this.el.setAttribute('material', 'color', '#ff007f');
      this.el.setAttribute('scale', '1.15 1.15 1.15');
    });
    this.el.addEventListener('mouseleave', () => {
      this.el.setAttribute('material', 'color', '#00ffd5');
      this.el.setAttribute('scale', '1 1 1');
    });
  }
});
