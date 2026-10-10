import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { getLastModule, launchPath, setLastModule } from '../modules'
import { ModuleSwitcher } from './ModuleSwitcher'

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/jour" element={<><ModuleSwitcher current="food" /><Where /></>} />
        <Route path="/muscu" element={<><ModuleSwitcher current="muscu" /><Where /></>} />
        <Route path="*" element={<Navigate to={launchPath()} replace />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ModuleSwitcher', () => {
  beforeEach(() => localStorage.clear())

  it('opens a menu of the modules and switches module', async () => {
    const user = userEvent.setup()
    renderAt('/jour')
    const button = screen.getByRole('button', { name: /^Alimentation/ })
    expect(screen.queryByRole('menu')).toBeNull()
    await user.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['Alimentation', 'Musculation'])
    await user.click(screen.getByRole('menuitem', { name: 'Musculation' }))
    expect(screen.getByTestId('where')).toHaveTextContent('/muscu')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(getLastModule()).toBe('muscu')
  })

  it('closes on Escape and on a tap outside', async () => {
    const user = userEvent.setup()
    renderAt('/jour')
    await user.click(screen.getByRole('button', { name: /^Alimentation/ }))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
    await user.click(screen.getByRole('button', { name: /^Alimentation/ }))
    await user.click(screen.getByTestId('where'))
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('opens the last module used at launch', () => {
    setLastModule('muscu')
    renderAt('/')
    expect(screen.getByTestId('where')).toHaveTextContent('/muscu')
  })

  it('opens Alimentation at launch on a new device', () => {
    renderAt('/')
    expect(screen.getByTestId('where')).toHaveTextContent('/jour')
  })
})
