import React, { useState, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'

// Interactive Floating Quest Pin Component
function QuestPin({ position, title, onSelect }) {
  const pinRef = useRef()

  // Gentle floating animation up and down
  useFrame(({ clock }) => {
    if (pinRef.current) {
      pinRef.current.position.y = position[1] + Math.sin(clock.getElapsedTime() * 2) * 0.2
    }
  })

  return (
    <group ref={pinRef} position={position}>
      {/* 3D Pin Mesh */}
      <mesh position={[0, 0.5, 0]}>
        <coneGeometry args={[0.3, 0.8, 8]} />
        <meshStandardMaterial color="#ff4757" roughness={0.3} />
      </mesh>

      {/* HTML Overlay for Game Title & Button */}
      <Html distanceFactor={15} center position={[0, 1.2, 0]}>
        <div style={pinCardStyle}>
          <p style={{ margin: 0, fontWeight: 'bold' }}>{title}</p>
          <button style={pinButtonStyle} onClick={() => onSelect(title)}>
            Attempt Quest
          </button>
        </div>
      </Html>
    </group>
  )
}

// Low-Poly Stylized Building Mesh
function LowPolyBuilding({ position, size, color, name }) {
  return (
    <group position={position}>
      {/* Main Structure */}
      <mesh position={[0, size[1] / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
      {/* Roof Decor */}
      <mesh position={[0, size[1] + 0.2, 0]}>
        <boxGeometry args={[size[0] * 0.8, 0.4, size[2] * 0.8]} />
        <meshStandardMaterial color="#2c3e50" />
      </mesh>
    </group>
  )
}

export default function SimsCampusMap() {
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [selectedQuest, setSelectedQuest] = useState('')

  const handleQuestClick = (questTitle) => {
    setSelectedQuest(questTitle)
    setShowAuthModal(true)
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#1e272e' }}>
      <Canvas
        shadows
        camera={{ position: [15, 18, 20], fov: 45 }} // Isometric angle
      >
        {/* Lighting Setup */}
        <ambientLight intensity={0.7} />
        <directionalLight
          position={[10, 20, 15]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />

        {/* Camera Controls (Smooth Sims-Style Orbiting) */}
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          maxPolarAngle={Math.PI / 2.2} // Prevent camera from dipping below ground
          minDistance={10}
          maxDistance={35}
        />

        {/* Grass Terrain Base */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <planeGeometry args={[40, 40]} />
          <meshStandardMaterial color="#7bed9f" roughness={0.8} />
        </mesh>

        {/* Wits Campus Landmarks (Low-Poly Representations) */}
        {/* Great Hall */}
        <LowPolyBuilding position={[-4, 0, -2]} size={[4, 3, 3]} color="#f1f2f6" name="Great Hall" />
        {/* Matrix Hub */}
        <LowPolyBuilding position={[3, 0, 4]} size={[5, 2, 4]} color="#70a1ff" name="Matrix Hub" />
        {/* Science Stadium */}
        <LowPolyBuilding position={[-2, 0, 6]} size={[3, 2.5, 3]} color="#eccc68" name="Science Stadium" />

        {/* Connecting Pathways */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 2]}>
          <planeGeometry args={[2, 12]} />
          <meshStandardMaterial color="#dfe4ea" />
        </mesh>

        {/* Interactive Quest Pins */}
        <QuestPin position={[-4, 3, -2]} title="Great Hall History Quest" onSelect={handleQuestClick} />
        <QuestPin position={[3, 2, 4]} title="Matrix Tech Trivia" onSelect={handleQuestClick} />
        <QuestPin position={[-2, 2.5, 6]} title="Science Stadium Dash" onSelect={handleQuestClick} />
      </Canvas>

      {/* Login Gate Modal Prompt */}
      {showAuthModal && (
        <div style={modalOverlayStyle}>
          <div style={modalStyle}>
            <h2 style={{ margin: '0 0 10px 0' }}>🎮 Quest Gate</h2>
            <p style={{ margin: '0 0 20px 0' }}>
              You clicked <strong>{selectedQuest}</strong>! Please log in as a Wits student or guest to join.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button style={primaryBtnStyle} onClick={() => alert('Redirecting to auth endpoint...')}>
                Log In / Register
              </button>
              <button style={secondaryBtnStyle} onClick={() => setShowAuthModal(false)}>
                Explore Map Only
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// UI Styling
const pinCardStyle = {
  background: 'rgba(255, 255, 255, 0.95)',
  padding: '6px 10px',
  borderRadius: '8px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
  textAlign: 'center',
  whiteSpace: 'nowrap',
  pointerEvents: 'auto'
}

const pinButtonStyle = {
  marginTop: '4px',
  background: '#2e86de',
  color: '#fff',
  border: 'none',
  padding: '4px 8px',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '11px',
  fontWeight: 'bold'
}

const modalOverlayStyle = {
  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.65)', display: 'flex',
  justifyContent: 'center', alignItems: 'center', zIndex: 1000
}

const modalStyle = {
  background: '#ffffff', padding: '24px', borderRadius: '12px',
  textAlign: 'center', maxWidth: '380px', width: '90%', color: '#2d3436',
  boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
}

const primaryBtnStyle = {
  background: '#10ac84', color: '#fff', border: 'none',
  padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold'
}

const secondaryBtnStyle = {
  background: '#8395a7', color: '#fff', border: 'none',
  padding: '8px 16px', borderRadius: '6px', cursor: 'pointer'
}