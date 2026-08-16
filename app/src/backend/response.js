export const error = (res, code, err_msg) =>
	res.status(code).json({ error: err_msg })
export const success = (res, body) => res.status(200).json(body)
