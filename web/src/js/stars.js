(function(){
  'use strict';

  let canvas = document.querySelector('section.space canvas');
  function checkWebGL() {
    try {
      let gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      return (gl && gl instanceof WebGLRenderingContext) ? true : false;
    } catch (e) {
      return false;
  	}
  }
  if (!checkWebGL()) {
    console.log('We are sorry, but your browser does not seem to support WebGL');
    return;
  }

  // progressive enhancement
  const FRAME_INTERVAL = 30;
  const SLEEP_INTERVAL = 100;

  let renderer, scene, camera;
  let particleSystem;
  let vert_shader = document.getElementById('stars-vert').textContent;
  let frag_shader = document.getElementById('stars-frag').textContent;
  let sleep = false;
  let sleep_break = window.innerHeight * 0.95;

  // dev pause
  // let logo = document.querySelector('.hero-logo');
  // logo.addEventListener("click", () => sleep = !sleep);

  function init() {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: false, antialias: false});
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize(window.innerWidth, window.innerHeight);
    window.addEventListener('resize', onResize, false);
    window.addEventListener('scroll', debounce(onScroll, 50), false);
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    sleep_break = window.innerHeight * 0.95;
  }

  function onScroll() {
    //sleep = window.scrollY > sleep_break;
  }

  function initScene() {
    // Particle system
    let numParticles = 5000;
    let radius = 1000;
    let depth = 5000;

    let geometry = new THREE.BufferGeometry();
    let positions = new Float32Array(numParticles * 3);

    let color = new THREE.Color();
    for (let i = 0; i < numParticles; i++) {
      // Random point in circle
      let t = 2 * Math.PI * Math.random();
      let u = Math.random() + Math.random();
      let r = (u > 1 ? 2 - u : u);
      let x = radius * r * Math.cos(t);
      let y = radius * r * Math.sin(t);
      let z = Math.random() * depth;
      positions[i*3]     = x;
      positions[i*3 + 1] = y;
      positions[i*3 + 2] = z;
    }

    geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.computeBoundingSphere();

    let uniforms = {
      time: { type: "f", value: 0 },
      radius: { type: "f", value: radius },
      depth: { type: "f", value: depth },
      alpha: { type: "f", value: 0.95 },
      pointSize: { type: "f", value: 2.3 },
      speed: { type: "f", value: 10.0 }
    };
    let material = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: vert_shader,
      fragmentShader: frag_shader,
      transparent: true,
      depthTest: false,
    });
    material.blending = THREE.AdditiveBlending;

    particleSystem = new THREE.Points(geometry, material);
    scene = new THREE.Scene();
    scene.add(particleSystem);

    // Camera
    let cameraZ = -1000;
    camera = new THREE.PerspectiveCamera(27, window.innerWidth / window.innerHeight, 1, 10000);
    camera.position.set(0, 0, cameraZ);
    camera.lookAt(new THREE.Vector3(0, 0, depth));
  }

  function render() {
    let time = performance.now() / 1000;
    particleSystem.material.uniforms.time.value = time;

    let depth = particleSystem.material.uniforms.depth.value;
    let positions = particleSystem.geometry.attributes.position;
    let speed = particleSystem.material.uniforms.speed.value;

    for (let i = 0; i < positions.count * 3; i += 3) {
      positions.array[ i + 2 ] -= speed;
      if (positions.array[ i + 2 ] < 0) { positions.array[ i + 2 ] += depth; }
    }
    positions.needsUpdate = true;
    particleSystem.rotation.z = time * 0.05;

    renderer.render(scene, camera);
  }

  function update() {
    if (!sleep) { render(); }
    setTimeout(update, (sleep ? SLEEP_INTERVAL : FRAME_INTERVAL));
  }

  init();
  initScene();
  update();
})();
