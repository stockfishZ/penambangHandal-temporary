const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
// Thicker fog to mask the horizon cutoff cleanly
scene.fog = new THREE.FogExp2(0x070B09, 0.035); 

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 3, 12);
camera.lookAt(0, 0, 0);

// Increased segmentation (100x100) to support high-frequency rough details
const geometry = new THREE.PlaneGeometry(80, 80, 100, 100);
geometry.rotateX(-Math.PI / 2);

const solidMat = new THREE.MeshBasicMaterial({ color: 0x070B09 });
const solidMesh = new THREE.Mesh(geometry, solidMat);
scene.add(solidMesh);

const wireMat = new THREE.MeshBasicMaterial({ 
    color: 0x9FD8BD, 
    wireframe: true,
    transparent: true,
    opacity: 0.15 
});
const wireMesh = new THREE.Mesh(geometry, wireMat);
wireMesh.position.y = 0.02; 
scene.add(wireMesh);

const clock = new THREE.Clock();
const positions = geometry.attributes.position;

// Store original coordinates so we aren't compounding noise on top of noise every frame
const originalPositions = new Float32Array(positions.count * 3);
for(let i = 0; i < positions.count; i++) {
    originalPositions[i*3] = positions.getX(i);
    originalPositions[i*3+1] = positions.getY(i);
    originalPositions[i*3+2] = positions.getZ(i);
}

function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime() * 0.05; // Slowed down for a tectonic, heavy feel
    
    for(let i = 0; i < positions.count; i++) {
        const x = originalPositions[i*3];
        const z = originalPositions[i*3+2];
        
        // 1. Base rolling hills (Low frequency)
        let y = Math.sin(x * 0.1 + time) * Math.cos(z * 0.1 + time) * 1.5;
        
        // 2. Sharp geological ridges (Absolute value creates peaks instead of waves)
        y += Math.abs(Math.sin(x * 0.25 - time * 1.5) * Math.cos(z * 0.25 + time)) * 1.2;
        
        // 3. High-frequency grit and rough noise
        y += Math.sin(x * 0.8 + time * 2) * Math.cos(z * 0.8 - time * 2) * 0.2;
        y += Math.sin(x * 1.5) * Math.cos(z * 1.5) * 0.05; // Static micro-roughness
        
        positions.setY(i, y);
    }
    
    positions.needsUpdate = true; 
    
    // Subtle cinematic camera drift
    camera.position.x = Math.sin(time * 0.5) * 1.5;
    camera.lookAt(0, -1, 0);

    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});