import { jest } from '@jest/globals'
import { error, success } from './response.js'

function mockRes() {
	const json = jest.fn().mockReturnThis()
	const status = jest.fn().mockReturnValue({ json })
	return { status, json, _status: status, _json: json }
}

describe('response helpers', () => {
	test('error sends code and error payload', () => {
		const res = mockRes()
		error(res, 400, 'bad')
		expect(res._status).toHaveBeenCalledWith(400)
		expect(res._json).toHaveBeenCalledWith({ error: 'bad' })
	})
	test('success sends 200 and body', () => {
		const res = mockRes()
		success(res, { ok: true })
		expect(res._status).toHaveBeenCalledWith(200)
		expect(res._json).toHaveBeenCalledWith({ ok: true })
	})
})
