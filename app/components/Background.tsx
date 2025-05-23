import React from 'react'

const Background: React.FC = () => {
  return (
    <div
      className="fixed inset-0"
      style={{
        pointerEvents: 'none',
        background: `
          radial-gradient(ellipse at 75% 25%, #f3eaff 0, #b6b6f6 40%, #5a7fdc 70%, #1a2a5c 100%);
          
          linear-gradient(160deg, #2a2a3a, #1e1e2f 100%)
        `,
        zIndex: -1,
        width: '100%',
        height: '100%',
      }}
    />
  )
}

export default Background