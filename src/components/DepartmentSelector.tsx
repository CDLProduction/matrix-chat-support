import React from 'react'
import { Department, DepartmentSelectionConfig } from '@/types'
import styles from '@/styles/widget.module.css'

interface DepartmentSelectorProps {
  departments: Department[]
  config: DepartmentSelectionConfig
  onSelect: (department: Department) => void
  onClose: () => void
}

const DepartmentSelector: React.FC<DepartmentSelectorProps> = ({
  departments,
  config,
  onSelect,
  onClose
}) => {
  const getLayoutClass = () => {
    return config.layout === 'list' ? styles.listLayout : styles.gridLayout
  }

  return (
    <div className={styles.departmentSelection}>
      <div className={styles.selectorHeader}>
        <div>
          <h3 className={styles.selectorTitle}>
            {config.title || 'How can we help you today?'}
          </h3>
          <p className={styles.selectorSubtitle}>
            {config.subtitle || 'Choose the team that best matches your needs'}
          </p>
          {/* Space context indicator for department selection */}
          <div className={styles.spaceContextInfo}>
            <svg className={styles.spaceContextIcon} width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4 2H20C21.1 2 22 2.9 22 4V20C22 21.1 21.1 22 20 22H4C2.9 22 2 21.1 2 20V4C2.9 2 4 2.9 4 2ZM4 4V8H20V4H4ZM4 10V14H12V10H4ZM14 10V14H20V10H14ZM4 16V20H12V16H4ZM14 16V20H20V16H14Z"/>
            </svg>
            <span>All conversations organized in Web-Chat Space</span>
          </div>
        </div>
      </div>
      
      <div className={`${styles.departmentGrid} ${getLayoutClass()}`}>
        {departments.map(department => (
          <button
            key={department.id}
            type="button"
            className={styles.departmentCard}
            onClick={() => onSelect(department)}
            style={{
              '--department-color': department.color || '#4F46E5',
              borderColor: department.color || '#e2e8f0'
            } as React.CSSProperties}
            aria-label={`Select ${department.name} department`}
          >
            {department.icon && (
              <div className={styles.departmentIcon}>
                {department.icon}
              </div>
            )}
            <h4 className={styles.departmentName}>
              {department.name}
            </h4>
            {config.showDescriptions !== false && department.description && (
              <p className={styles.departmentDescription}>
                {department.description}
              </p>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

export default DepartmentSelector