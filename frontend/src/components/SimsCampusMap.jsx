import React, { useState, useRef, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { PointerLockControls, OrbitControls, Html } from '@react-three/drei'
import * as THREE from 'three'

// ---------------------------------------------------------------------------
// Recalibrated East Campus Buildings (Origin [0,0,0] = Great Hall Steps)
// X: +East (Jan Smuts), -West (Yale Rd) | Z: -North (Empire Rd), +South (Jorissen)
// ---------------------------------------------------------------------------
const EAST_CAMPUS_BUILDINGS = [
  // --- CENTRAL QUAD & ADMINISTRATION ---
  {
    id: 'great_hall',
    name: 'Great Hall & Central Block',
    pos: [0, 0, 0],
    size: [60, 22, 35],
    color: '#dcdde1',
    description: 'Iconic Wits central hub and graduation hall.'
  },
  {
    id: 'solomon_mahlangu',
    name: 'Solomon Mahlangu House (Senate House)',
    pos: [15, 0, 60],
    size: [55, 40, 30],
    color: '#718093',
    description: 'Main administrative block and student enrolment center.'
  },
  {
    id: 'robert_sobukwe',
    name: 'Robert Sobukwe Block',
    pos: [0, 0, -25],
    size: [50, 15, 20],
    color: '#a4b0be',
    description: 'Academic block directly behind Great Hall.'
  },

  // --- LIBRARIES & CENTRAL QUAD ---
  {
    id: 'cullen_library',
    name: 'William Cullen Library',
    pos: [-45, 0, -60],
    size: [30, 16, 35],
    color: '#8c7ae6',
    description: 'Historical library housing university archives.'
  },
  {
    id: 'wartenweiler_library',
    name: 'Wartenweiler Library',
    pos: [25, 0, -50],
    size: [35, 18, 40],
    color: '#9c88ff',
    description: 'Main undergraduate and research library.'
  },
  {
    id: 'umthombo',
    name: 'Umthombo Building',
    pos: [30, 0, -110],
    size: [45, 16, 30],
    color: '#487eb0',
    description: 'Major lecture theatre complex and computer labs.'
  },

  // --- WEST ACADEMIC QUAD (ENGINEERING & GEOSCIENCES) ---
  {
    id: 'geosciences',
    name: 'Geosciences Building',
    pos: [-60, 0, -10],
    size: [25, 15, 30],
    color: '#e1b12c',
    description: 'School of Geosciences.'
  },
  {
    id: 'hillman',
    name: 'Hillman Building',
    pos: [-75, 0, 25],
    size: [28, 14, 25],
    color: '#cc8e35',
    description: 'Civil & Environmental Engineering.'
  },
  {
    id: 'sw_engineering',
    name: 'South West Engineering',
    pos: [-85, 0, -15],
    size: [30, 15, 35],
    color: '#d35400',
    description: 'Engineering classrooms and offices.'
  },
  {
    id: 'nw_engineering',
    name: 'North West Engineering',
    pos: [-95, 0, -65],
    size: [35, 16, 40],
    color: '#cd6133',
    description: 'Faculty of Engineering laboratories and lectures.'
  },
  {
    id: 'bernard_price',
    name: 'Bernard Price Building',
    pos: [-110, 0, 50],
    size: [25, 12, 25],
    color: '#84817a',
    description: 'Geophysics and palaeontological research.'
  },
  {
    id: 'origins_centre',
    name: 'Origins Centre Museum',
    pos: [-140, 0, 80],
    size: [35, 10, 30],
    color: '#ccae62',
    description: 'World-renowned museum of human origin and rock art.'
  },
  {
    id: 'richard_ward',
    name: 'Richard Ward Building',
    pos: [-60, 0, 60],
    size: [30, 16, 25],
    color: '#706fd3',
    description: 'Chemical & Metallurgical Engineering.'
  },

  // --- EAST ACADEMIC QUAD (SCIENCE & ARTS) ---
  {
    id: 'physics',
    name: 'Physics Building',
    pos: [55, 0, -15],
    size: [40, 16, 30],
    color: '#2e86de',
    description: 'School of Physics research laboratories.'
  },
  {
    id: 'humphrey_raikes',
    name: 'Humphrey Raikes (Chemistry)',
    pos: [60, 0, 25],
    size: [42, 18, 30],
    color: '#10ac84',
    description: 'School of Chemistry.'
  },
  {
    id: 'oppenheimer_life_sci',
    name: 'Oppenheimer Life Sciences',
    pos: [100, 0, -40],
    size: [45, 18, 40],
    color: '#10893e',
    description: 'Biological and Environmental Sciences.'
  },
  {
    id: 'wits_art_school',
    name: 'Wits School of Arts',
    pos: [110, 0, 55],
    size: [35, 14, 30],
    color: '#ff5252',
    description: 'Fine Arts, Music, and Dramatic Art departments.'
  },
  {
    id: 'wits_theatre',
    name: 'Wits Theatre Complex',
    pos: [65, 0, 80],
    size: [35, 14, 30],
    color: '#ff793f',
    description: 'Main campus performing arts theatre.'
  },

  // --- NORTH-CENTRAL COMPLEX (MATRIX & ARCHITECTURE) ---
  {
    id: 'matrix',
    name: 'The Matrix Student Center',
    pos: [0, 0, -165],
    size: [45, 12, 35],
    color: '#ffb142',
    description: 'Student retail center, dining hall, and services.'
  },
  {
    id: 'john_moffat',
    name: 'John Moffat Building',
    pos: [-55, 0, -145],
    size: [40, 14, 30],
    color: '#34ace0',
    description: 'Architecture and Planning Faculty.'
  },
  {
    id: 'old_mutual_hall',
    name: 'Old Mutual Sports Hall',
    pos: [20, 0, -220],
    size: [45, 14, 40],
    color: '#33d9b2',
    description: 'Indoor sports center and gymnasium.'
  },

  // --- NORTHERN SPORTS COMPLEX BUILDINGS ---
  {
    id: 'bozzoli_pavilion',
    name: 'Bozzoli Sports Pavilion',
    pos: [50, 0, -310],
    size: [35, 12, 25],
    color: '#eccc68',
    description: 'Main pavilion overlooking rugby and cricket grounds.'
  },
  {
    id: 'schonland_research',
    name: 'Schonland Research Institute',
    pos: [-80, 0, -270],
    size: [55, 14, 30],
    color: '#70a1ff',
    description: 'Nuclear Sciences Research Institute.'
  }
]

const TREE_LOCATIONS = [
  [-15, 0, -45], [15, 0, -45], [-15, 0, -75], [15, 0, -75],
  [-15, 0, -100], [15, 0, -100], [-15, 0, -125], [15, 0, -125],
  [-40, 0, 10], [40, 0, 10], [-40, 0, 35], [40, 0, 35],
  [-110, 0, 15], [-110, 0, 35], [100, 0, 10], [100, 0, 30],
  [-130, 0, -320], [-130, 0, -380], [120, 0, -320], [120, 0, -380]
]

// ---------------------------------------------------------------------------
// AABB Collision Detection Helper
// ---------------------------------------------------------------------------
function checkAABBCollision(newPos, radius, building) {
  const [bX, bY, bZ] = building.pos
  const [bWidth, bHeight, bDepth] = building.size

  const minX = bX - bWidth / 2 - radius
  const maxX = bX + bWidth / 2 + radius
  const minZ = bZ - bDepth / 2 - radius
  const maxZ = bZ + bDepth / 2 + radius

  return newPos.x >= minX && newPos.x <= maxX && newPos.z >= minZ && newPos.z <= maxZ
}

// ---------------------------------------------------------------------------
// Northern Sports Grounds Component
// ---------------------------------------------------------------------------
function NorthernSportsComplex() {
  return (
    <group position={[0, 0, 0]}>
      {/* 1. Swimming Pool Complex */}
      <group position={[-40, 0, -300]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} receiveShadow>
          <planeGeometry args={[35, 25]} />
          <meshStandardMaterial color="#ced6e0" roughness={0.5} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
          <planeGeometry args={[28, 18]} />
          <meshStandardMaterial color="#00a8ff" roughness={0.1} transparent opacity={0.8} />
        </mesh>
        <Html position={[0, 2, 0]} center distanceFactor={50}>
          <div style={sportsLabelStyle}>🏊 Wits Swimming Pool</div>
        </Html>
      </group>

      {/* 2. Walter Milton Oval */}
      <group position={[0, 0, -320]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} receiveShadow>
          <circleGeometry args={[50, 32]} />
          <meshStandardMaterial color="#2ed573" roughness={0.8} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
          <planeGeometry args={[8, 25]} />
          <meshStandardMaterial color="#eccc68" />
        </mesh>
        <Html position={[0, 2, 0]} center distanceFactor={60}>
          <div style={sportsLabelStyle}>🏏 Walter Milton Oval</div>
        </Html>
      </group>

      {/* 3. Rugby Stadium & Grandstands */}
      <group position={[60, 0, -350]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} receiveShadow>
          <planeGeometry args={[50, 90]} />
          <meshStandardMaterial color="#20bf6b" roughness={0.8} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
          <planeGeometry args={[48, 2]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <mesh position={[-28, 4, 0]} castShadow receiveShadow>
          <boxGeometry args={[8, 8, 70]} />
          <meshStandardMaterial color="#a4b0be" />
        </mesh>
        <mesh position={[28, 4, 0]} castShadow receiveShadow>
          <boxGeometry args={[8, 8, 70]} />
          <meshStandardMaterial color="#a4b0be" />
        </mesh>
        <Html position={[0, 2, 0]} center distanceFactor={60}>
          <div style={sportsLabelStyle}>🏉 Rugby Stadium</div>
        </Html>
      </group>

      {/* 4. Soccer Field B */}
      <group position={[-100, 0, -340]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} receiveShadow>
          <planeGeometry args={[45, 80]} />
          <meshStandardMaterial color="#26de81" roughness={0.8} />
        </mesh>
        <Html position={[0, 2, 0]} center distanceFactor={60}>
          <div style={sportsLabelStyle}>⚽ Soccer Field B</div>
        </Html>
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// First Person Player with Collision Detection
// ---------------------------------------------------------------------------
function FirstPersonPlayer({ active }) {
  const { camera } = useThree()
  const moveState = useRef({ forward: false, backward: false, left: false, right: false })
  const direction = useRef(new THREE.Vector3())
  const PLAYER_RADIUS = 1.5

  useEffect(() => {
    if (!active) return

    camera.position.set(0, 1.65, 80)

    const handleKeyDown = (e) => {
      switch (e.code) {
        case 'KeyW': case 'ArrowUp': moveState.current.forward = true; break
        case 'KeyS': case 'ArrowDown': moveState.current.backward = true; break
        case 'KeyA': case 'ArrowLeft': moveState.current.left = true; break
        case 'KeyD': case 'ArrowRight': moveState.current.right = true; break
        default: break
      }
    }

    const handleKeyUp = (e) => {
      switch (e.code) {
        case 'KeyW': case 'ArrowUp': moveState.current.forward = false; break
        case 'KeyS': case 'ArrowDown': moveState.current.backward = false; break
        case 'KeyA': case 'ArrowLeft': moveState.current.left = false; break
        case 'KeyD': case 'ArrowRight': moveState.current.right = false; break
        default: break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [camera, active])

  useFrame((_, delta) => {
    if (!active) return

    const moveSpeed = 25.0 * delta

    direction.current.z = Number(moveState.current.forward) - Number(moveState.current.backward)
    direction.current.x = Number(moveState.current.right) - Number(moveState.current.left)
    direction.current.normalize()

    const oldPosition = camera.position.clone()

    // Move Forward/Backward & Check Collisions
    if (moveState.current.forward || moveState.current.backward) {
      camera.translateZ(-direction.current.z * moveSpeed)
      const hitsZ = EAST_CAMPUS_BUILDINGS.some((b) =>
        checkAABBCollision(camera.position, PLAYER_RADIUS, b)
      )
      if (hitsZ) {
        camera.position.z = oldPosition.z
      }
    }

    // Move Left/Right & Check Collisions
    if (moveState.current.left || moveState.current.right) {
      camera.translateX(direction.current.x * moveSpeed)
      const hitsX = EAST_CAMPUS_BUILDINGS.some((b) =>
        checkAABBCollision(camera.position, PLAYER_RADIUS, b)
      )
      if (hitsX) {
        camera.position.x = oldPosition.x
      }
    }

    camera.position.y = 1.65
  })

  return null
}

// ---------------------------------------------------------------------------
// Camera View Switcher Manager
// ---------------------------------------------------------------------------
function CameraViewManager({ viewMode }) {
  const { camera } = useThree()

  useEffect(() => {
    if (viewMode === 'top') {
      camera.position.set(0, 480, -120)
      camera.lookAt(0, 0, -160)
    }
  }, [viewMode, camera])

  return null
}

// ---------------------------------------------------------------------------
// Yale Road Trench & Amic Deck Plaza
// ---------------------------------------------------------------------------
function YaleRoadAndBridge() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-150, -5.0, -100]} receiveShadow>
        <planeGeometry args={[20, 600]} />
        <meshStandardMaterial color="#2f3640" roughness={0.9} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-150, -4.95, -100]}>
        <planeGeometry args={[0.6, 600]} />
        <meshStandardMaterial color="#fbc531" />
      </mesh>

      <mesh position={[-160, -2.5, -100]} receiveShadow castShadow>
        <boxGeometry args={[1, 5, 600]} />
        <meshStandardMaterial color="#718093" />
      </mesh>
      <mesh position={[-140, -2.5, -100]} receiveShadow castShadow>
        <boxGeometry args={[1, 5, 600]} />
        <meshStandardMaterial color="#718093" />
      </mesh>

      <group position={[-150, 0, -30]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} receiveShadow>
          <planeGeometry args={[22, 50]} />
          <meshStandardMaterial color="#dcdde1" roughness={0.7} />
        </mesh>
        <mesh position={[0, 1.2, 25]}>
          <boxGeometry args={[22, 1.4, 0.3]} />
          <meshStandardMaterial color="#fbc531" />
        </mesh>
        <mesh position={[0, 1.2, -25]}>
          <boxGeometry args={[22, 1.4, 0.3]} />
          <meshStandardMaterial color="#fbc531" />
        </mesh>
        <Html position={[0, 3, 0]} center distanceFactor={60}>
          <div style={bridgeLabelStyle}>🌉 Amic Deck (To West Campus)</div>
        </Html>
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// Architectural Components
// ---------------------------------------------------------------------------
function Tree({ position }) {
  return (
    <group position={position}>
      <mesh position={[0, 2.5, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.5, 5, 8]} />
        <meshStandardMaterial color="#4a3728" roughness={0.9} />
      </mesh>
      <mesh position={[0, 6, 0]} castShadow>
        <coneGeometry args={[3, 6, 8]} />
        <meshStandardMaterial color="#2e7d32" roughness={0.8} />
      </mesh>
    </group>
  )
}

function BuildingStructure({ pos, size, color, name, description }) {
  const [hovered, setHovered] = useState(false)

  return (
    <group position={pos}>
      <mesh
        position={[0, size[1] / 2, 0]}
        castShadow
        receiveShadow
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
        }}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={size} />
        <meshStandardMaterial color={hovered ? '#fbc531' : color} roughness={0.6} />
      </mesh>

      <Html position={[0, size[1] + 3, 0]} center distanceFactor={70}>
        <div style={hovered ? activeLabelStyle : labelStyle}>
          <strong>{name}</strong>
          {hovered && <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#dcdde1' }}>{description}</p>}
        </div>
      </Html>
    </group>
  )
}

// ---------------------------------------------------------------------------
// Main Scene Viewport
// ---------------------------------------------------------------------------
export default function SimsCampusMap() {
  const [viewMode, setViewMode] = useState('fps')
  const [isLocked, setIsLocked] = useState(false)

  useEffect(() => {
    const handleGlobalKey = (e) => {
      if (e.code === 'KeyV' || e.code === 'KeyM') {
        setViewMode((prev) => (prev === 'fps' ? 'top' : 'fps'))
      }
    }
    window.addEventListener('keydown', handleGlobalKey)
    return () => window.removeEventListener('keydown', handleGlobalKey)
  }, [])

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#7f8fa6' }}>
      <div style={toolbarStyle}>
        <button
          style={viewMode === 'top' ? activeButtonStyle : buttonStyle}
          onClick={() => setViewMode('top')}
        >
          🗺️ Full East Campus Overview
        </button>
        <button
          style={viewMode === 'fps' ? activeButtonStyle : buttonStyle}
          onClick={() => setViewMode('fps')}
        >
          🚶 Walk East Campus
        </button>
      </div>

      {viewMode === 'fps' && !isLocked && (
        <div style={instructionOverlayStyle}>
          <div style={instructionCardStyle}>
            <h2 style={{ margin: '0 0 10px 0', color: '#2f3640' }}>🏛️ Wits East Campus Walk</h2>
            <p style={{ margin: '0 0 15px 0', color: '#353b48', fontSize: '14px', lineHeight: '1.5' }}>
              Explore East Campus with wall collisions enabled. Press <strong>V</strong> or <strong>M</strong> to toggle the top-down map.
            </p>
            <div style={controlKeyGrid}>
              <span><strong>W, A, S, D</strong> : Walk</span>
              <span><strong>Mouse</strong> : Look Around</span>
              <span><strong>ESC</strong> : Unlock Mouse</span>
            </div>
            <p style={{ marginTop: '15px', fontWeight: 'bold', color: '#e84118', fontSize: '13px' }}>
              Click anywhere to start walking.
            </p>
          </div>
        </div>
      )}

      <Canvas shadows camera={{ fov: 60, near: 0.1, far: 2000 }}>
        <ambientLight intensity={0.65} />
        <directionalLight
          position={[100, 200, 50]}
          intensity={1.3}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />

        <CameraViewManager viewMode={viewMode} />

        {viewMode === 'fps' ? (
          <>
            <PointerLockControls
              onLock={() => setIsLocked(true)}
              onUnlock={() => setIsLocked(false)}
            />
            <FirstPersonPlayer active={true} />
          </>
        ) : (
          <OrbitControls
            enableRotate={true}
            enablePan={true}
            enableZoom={true}
            maxPolarAngle={Math.PI / 2.1}
            target={[0, 0, -150]}
          />
        )}

        {/* Base Ground */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -150]} receiveShadow>
          <planeGeometry args={[450, 600]} />
          <meshStandardMaterial color="#44bd32" roughness={0.9} />
        </mesh>

        {/* Hostel Drive Boundary */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -250]} receiveShadow>
          <planeGeometry args={[320, 14]} />
          <meshStandardMaterial color="#2f3640" roughness={0.8} />
        </mesh>

        {/* Central Library Lawn */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -60]} receiveShadow>
          <planeGeometry args={[30, 80]} />
          <meshStandardMaterial color="#2ed573" roughness={0.8} />
        </mesh>

        {/* Main Concourse */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, -15]} receiveShadow>
          <planeGeometry args={[220, 18]} />
          <meshStandardMaterial color="#dcdde1" roughness={0.7} />
        </mesh>

        {/* Northern Boundary */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -420]} receiveShadow>
          <planeGeometry args={[450, 20]} />
          <meshStandardMaterial color="#2f3640" roughness={0.9} />
        </mesh>

        {/* Jan Smuts Ave Boundary */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[160, 0.01, -150]} receiveShadow>
          <planeGeometry args={[20, 600]} />
          <meshStandardMaterial color="#2f3640" roughness={0.9} />
        </mesh>

        {/* Northern Sports Grounds */}
        <NorthernSportsComplex />

        {/* Yale Road Trench & Amic Deck */}
        <YaleRoadAndBridge />

        {/* Trees */}
        {TREE_LOCATIONS.map((pos, index) => (
          <Tree key={index} position={pos} />
        ))}

        {/* Buildings */}
        {EAST_CAMPUS_BUILDINGS.map((b) => (
          <BuildingStructure key={b.id} {...b} />
        ))}
      </Canvas>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const toolbarStyle = {
  position: 'absolute',
  top: '20px',
  right: '20px',
  zIndex: 150,
  display: 'flex',
  gap: '10px',
  background: 'rgba(47, 54, 64, 0.9)',
  padding: '8px',
  borderRadius: '8px',
  boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
}

const buttonStyle = {
  background: '#353b48',
  color: '#f5f6fa',
  border: 'none',
  padding: '8px 14px',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: 'bold'
}

const activeButtonStyle = {
  background: '#e84118',
  color: '#ffffff',
  border: 'none',
  padding: '8px 14px',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: 'bold',
  boxShadow: '0 2px 10px rgba(232, 65, 24, 0.5)'
}

const labelStyle = {
  background: 'rgba(47, 54, 64, 0.85)',
  color: '#f5f6fa',
  padding: '5px 10px',
  borderRadius: '5px',
  fontSize: '11px',
  pointerEvents: 'none',
  whiteSpace: 'nowrap',
  textAlign: 'center',
  border: '1px solid #718093'
}

const activeLabelStyle = {
  background: '#e84118',
  color: '#ffffff',
  padding: '7px 12px',
  borderRadius: '6px',
  fontSize: '12px',
  fontWeight: 'bold',
  pointerEvents: 'none',
  whiteSpace: 'nowrap',
  textAlign: 'center',
  boxShadow: '0 4px 15px rgba(0,0,0,0.4)'
}

const bridgeLabelStyle = {
  background: '#8395a7',
  color: '#ffffff',
  padding: '6px 12px',
  borderRadius: '4px',
  fontSize: '12px',
  fontWeight: 'bold',
  pointerEvents: 'none',
  whiteSpace: 'nowrap',
  border: '1px solid #ffffff'
}

const sportsLabelStyle = {
  background: 'rgba(32, 191, 107, 0.9)',
  color: '#ffffff',
  padding: '4px 10px',
  borderRadius: '20px',
  fontSize: '11px',
  fontWeight: 'bold',
  pointerEvents: 'none',
  whiteSpace: 'nowrap',
  boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
}

const instructionOverlayStyle = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  backgroundColor: 'rgba(0, 0, 0, 0.55)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 100,
  cursor: 'pointer'
}

const instructionCardStyle = {
  background: '#ffffff',
  padding: '30px',
  borderRadius: '12px',
  textAlign: 'center',
  maxWidth: '450px',
  boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
}

const controlKeyGrid = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  background: '#f1f2f6',
  padding: '12px',
  borderRadius: '8px',
  fontSize: '13px',
  color: '#2f3640'
}