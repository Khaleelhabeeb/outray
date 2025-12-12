import "./App.css";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMemo, useRef } from "react";

function Spotlight() {
  const mesh = useRef<THREE.Mesh>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: new THREE.Color("#ffffff") },
    }),
    [],
  );

  useFrame((state) => {
    if (mesh.current) {
      // @ts-expect-error - uTime is not in the type definition
      mesh.current.material.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <mesh ref={mesh} position={[-4, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
      {/* radiusTop, radiusBottom, height, radialSegments, heightSegments, openEnded */}
      <cylinderGeometry args={[1.2, 5, 16, 64, 1, true]} />
      <shaderMaterial
        side={THREE.DoubleSide}
        transparent={true}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={`
          varying vec2 vUv;
          varying vec3 vPos;
          void main() {
            vUv = uv;
            vPos = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform float uTime;
          uniform vec3 uColor;
          varying vec2 vUv;
          varying vec3 vPos;

          // Simple pseudo-random noise
          float random(vec2 st) {
            return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
          }

          void main() {
            // vUv.y goes from 0 (bottom/right) to 1 (top/left)
            
            // Fade out towards the right (end of beam)
            float beamLongitudinal = smoothstep(0.0, 0.6, vUv.y);
            
            // Fade out at the very source (left) to avoid hard geometry edge
            float sourceSoftness = smoothstep(1.0, 0.85, vUv.y);

            // Add some subtle "rays" or noise
            float noise = random(vec2(vUv.x * 20.0, 0.0)); 
            float ray = smoothstep(0.4, 0.6, noise) * 0.04;
            
            // Base beam body
            float alpha = beamLongitudinal * sourceSoftness * 0.06;
            alpha += ray * beamLongitudinal * sourceSoftness;
            
            // Soft core glow that fades before hitting the geometry edge
            float core = smoothstep(0.5, 0.85, vUv.y) * smoothstep(1.0, 0.85, vUv.y) * 0.15;
            alpha += core;

            gl_FragColor = vec4(uColor, alpha);
          }
        `}
      />
    </mesh>
  );
}

const generateParticles = (count: number) => {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = Math.random() * 4;
    const theta = Math.random() * Math.PI * 2;
    const x = (Math.random() - 0.5) * 16;
    pos[i * 3] = x;
    pos[i * 3 + 1] = r * Math.cos(theta);
    pos[i * 3 + 2] = r * Math.sin(theta);
  }
  return pos;
};

function Dust() {
  const count = 300;
  const mesh = useRef<THREE.Points>(null);

  const positions = useMemo(() => generateParticles(count), []);

  useFrame((state) => {
    if (mesh.current) {
      // Slowly rotate the dust
      mesh.current.rotation.x = state.clock.elapsedTime * 0.05;
      // Gentle horizontal float
      mesh.current.position.x =
        Math.sin(state.clock.elapsedTime * 0.2) * 0.5 - 4;
    }
  });

  return (
    <points ref={mesh} position={[-4, 0, 0]}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        color="#ffffff"
        transparent
        opacity={0.6}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function App() {
  return (
    <div className="relative flex items-center justify-center min-h-screen bg-black text-white overflow-hidden">
      <div className="absolute inset-0 z-0">
        <Canvas camera={{ position: [0, 0, 15], fov: 45 }}>
          <color attach="background" args={["#000000"]} />
          <Spotlight />
          <Dust />
        </Canvas>
      </div>

      <h1 className="relative z-10 text-8xl text-center font-medium opacity-80 tracking-tight">
        Opensource <br /> Ngrok alternative
      </h1>
    </div>
  );
}

export default App;
