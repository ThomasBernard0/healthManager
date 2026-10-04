import { render, screen } from '@testing-library/react'
import { healthCheck } from '../api/generated/endpoints/health/health'
import HomePage from './HomePage'

vi.mock('../api/generated/endpoints/health/health', () => ({
  healthCheck: vi.fn(),
}))

describe('HomePage', () => {
  it('shows the API status', async () => {
    vi.mocked(healthCheck).mockResolvedValue({ status: 'ok' })
    render(<HomePage />)
    expect(await screen.findByTestId('api-status')).toHaveTextContent('ok')
  })

  it('shows when the API is unreachable', async () => {
    vi.mocked(healthCheck).mockRejectedValue(new Error('down'))
    render(<HomePage />)
    expect(await screen.findByText('unreachable')).toBeInTheDocument()
  })
})
