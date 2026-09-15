// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './Button'

describe('Button', () => {
  it('is keyboard accessible and invokes its action', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Plan my trip</Button>)
    const button = screen.getByRole('button', { name: 'Plan my trip' })
    expect(button).toBeVisible()
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledOnce()
  })
})
