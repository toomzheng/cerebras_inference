'use client'

import React, { useRef } from 'react'
import { Button, type ButtonProps } from './button'
import { cn } from '@/lib/utils'

interface FileButtonProps extends Omit<ButtonProps, 'onChange'> {
  onChange: (file: File) => void
  accept?: string
}

export function FileButton({
  onChange,
  accept = '*',
  className,
  children,
  ...props
}: FileButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleClick = (e: React.MouseEvent) => {
    console.log('FileButton clicked')
    e.stopPropagation() // Prevent event from being captured by tooltip
    fileInputRef.current?.click()
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('File selected:', event.target.files)
    const file = event.target.files?.[0]
    if (file) {
      onChange(file)
    }
    // Reset the input so the same file can be selected again
    event.target.value = ''
  }

  return (
    <div onClick={handleClick}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept={accept}
        style={{ display: 'none' }}
      />
      <Button
        type="button"
        className={cn(className)}
        {...props}
      >
        {children}
      </Button>
    </div>
  )
}