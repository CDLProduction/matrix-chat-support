import React, { useState } from 'react'
import styles from '@/styles/widget.module.css'

interface LongMessageProps {
  text: string
  maxLength?: number
  className?: string
}

const LongMessage: React.FC<LongMessageProps> = ({ text, maxLength = 200, className = '' }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  
  if (text.length <= maxLength) {
    return <div className={className}>{text}</div>
  }

  const truncatedText = text.slice(0, maxLength).trim()
  
  return (
    <div className={className}>
      {isExpanded ? text : `${truncatedText}...`}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          background: 'none',
          border: 'none',
          color: 'inherit',
          opacity: 0.8,
          cursor: 'pointer',
          fontSize: '13px',
          marginLeft: '8px',
          textDecoration: 'none',
          padding: '2px 4px',
          borderRadius: '4px',
          fontWeight: 500,
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '1'
          e.currentTarget.style.textDecoration = 'underline'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '0.8'
          e.currentTarget.style.textDecoration = 'none'
        }}
      >
        {isExpanded ? 'Show less' : 'Show more'}
      </button>
    </div>
  )
}

export default LongMessage