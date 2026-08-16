import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('Visitor Map & Challenge Interceptor Logic', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it('saves target challenge ID and alerts when an unauthenticated user attempts a challenge', () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {})

    const isLoggedIn = false
    const buildingId = 'bldg_001'

    if (isLoggedIn) {
      sessionStorage.removeItem('pending_challenge_id')
    } else {
      sessionStorage.setItem('pending_challenge_id', buildingId)
      window.alert(`🔒 Login Required!\n\nRedirecting to login page...`)
    }

    expect(sessionStorage.getItem('pending_challenge_id')).toBe('bldg_001')
    expect(alertMock).toHaveBeenCalledOnce()
  })

  it('clears pending challenge ID when an authenticated user attempts a challenge', () => {
    sessionStorage.setItem('pending_challenge_id', 'bldg_001')

    const isLoggedIn = true

    if (isLoggedIn) {
      sessionStorage.removeItem('pending_challenge_id')
    }

    expect(sessionStorage.getItem('pending_challenge_id')).toBeNull()
  })

  it('detects pending challenge and opens target popup on application load', () => {
    sessionStorage.setItem('pending_challenge_id', 'bldg_004')
    const isLoggedIn = true

    const mockMarker = { openPopup: vi.fn() }
    const markersMap = new Map([['bldg_004', mockMarker]])

    const pendingChallengeId = sessionStorage.getItem('pending_challenge_id')

    if (pendingChallengeId && isLoggedIn) {
      const targetMarker = markersMap.get(pendingChallengeId)
      if (targetMarker) {
        targetMarker.openPopup()
      }
      sessionStorage.removeItem('pending_challenge_id')
    }

    expect(mockMarker.openPopup).toHaveBeenCalledOnce()
    expect(sessionStorage.getItem('pending_challenge_id')).toBeNull()
  })
})