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